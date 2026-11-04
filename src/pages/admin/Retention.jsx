import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  Repeat,
  UserPlus,
  AlertTriangle,
  UserX,
  TrendingUp,
  Search,
  MessageSquare,
  Send,
  Zap,
  Star,
  X
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const STATUS_META = {
  returning: { label: 'Returning', color: '#10b981' },
  new: { label: 'New', color: '#3b82f6' },
  at_risk: { label: 'At Risk', color: '#f59e0b' },
  churned: { label: 'Churned', color: '#ef4444' },
  inactive: { label: 'Inactive', color: '#94a3b8' }
}

function statusInfo(status) {
  return STATUS_META[status] || { label: status, color: '#94a3b8' }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function retentionReason(record) {
  if (record.status === 'inactive') return 'No verified visits recorded yet.'
  if (record.status === 'new') return `First verified visit ${record.days_since_last} day(s) ago.`
  if (record.status === 'returning') return `${record.visit_count} verified visits; last visit ${record.days_since_last} day(s) ago.`
  if (record.status === 'at_risk') return `Last verified visit ${record.days_since_last} day(s) ago.`
  return `Last verified visit ${record.days_since_last} day(s) ago; over 60 days.`
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits ? `***${digits.slice(-4)}` : '—'
}

function formatAccraDateTimeInput(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`
}

function Retention() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [data, setData] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sms, setSms] = useState({ status: null, sending: false, result: null })
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsSegment, setSmsSegment] = useState('')
  const [smsConfirmation, setSmsConfirmation] = useState(false)
  const [campaign, setCampaign] = useState({ running: false, result: null, success: false })
  const [smsMessage, setSmsMessage] = useState('Hello {name}, we have missed you at {campus}. We would love to see you again soon. Warm regards, the team.')
  const [smsHistory, setSmsHistory] = useState([])
  const [smsHistoryError, setSmsHistoryError] = useState('')
  const [smsServiceStatus, setSmsServiceStatus] = useState(null)
  const [retentionSettings, setRetentionSettings] = useState({
    firstTimeFollowUp: 'Hi {name}, we hope you enjoyed your visit to {campus}! Our facility is open and we would love to see you again soon.',
    atRiskWinback: "Hello {name}, we noticed it's been a few weeks since your last visit to {campus}. We miss having you! Drop by anytime.",
    cooldownDays: 7
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsFeedback, setSettingsFeedback] = useState('')
  const [campaignPreview, setCampaignPreview] = useState(null)
  const [campaignPreviewLoading, setCampaignPreviewLoading] = useState(false)
  const [campaignPreviewError, setCampaignPreviewError] = useState('')
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [schedules, setSchedules] = useState([])
  const [campaignAnalytics, setCampaignAnalytics] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const [res, fbRes, smsRes, settingsRes, analyticsRes, schedulesRes, serviceStatusRes] = await Promise.all([
        fetch(`${API_URL}/admin/retention`, { headers }),
        fetch(`${API_URL}/admin/feedback`, { headers }),
        fetch(`${API_URL}/admin/sms/logs`, { headers }),
        fetch(`${API_URL}/admin/retention/settings`, { headers }),
        fetch(`${API_URL}/admin/retention/analytics`, { headers }),
        fetch(`${API_URL}/admin/retention/schedules`, { headers }),
        fetch(`${API_URL}/sms/status`, { headers })
      ])

      if (!res.ok) throw new Error('Retention request failed')
      setData(await res.json())

      if (fbRes.ok) {
        setFeedback(await fbRes.json())
      }
      if (smsRes.ok) {
        const smsData = await smsRes.json()
        setSmsHistory(smsData.logs || [])
        setSmsHistoryError('')
      } else {
        setSmsHistoryError('SMS history is unavailable.')
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setRetentionSettings(settingsData.settings)
      }
      if (analyticsRes.ok) setCampaignAnalytics(await analyticsRes.json())
      if (schedulesRes.ok) {
        const scheduleData = await schedulesRes.json()
        setSchedules(scheduleData.schedules || [])
      }
      if (serviceStatusRes.ok) setSmsServiceStatus(await serviceStatusRes.json())
      setError('')
    } catch (err) {
      console.error('Error fetching retention:', err)
      setError('Unable to load retention data. The connection or session may have expired.')
    } finally {
      setLoading(false)
    }
  }, [activeCampus])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const sendEngagementSms = useCallback(async () => {
    if (!data || !smsSegment) return
    const recipients = (data.records || [])
      .filter((r) => r.phone && !r.sms_opt_out && (smsSegment === 'all' || r.status === smsSegment))
      .map((r) => ({ id: r.id, phone: r.phone, name: r.name }))
    if (recipients.length === 0) {
      setSms({ status: 'error', sending: false, result: 'No members in this section have a phone number to text.' })
      return
    }
    setSms((prev) => ({ ...prev, sending: true, result: null, status: null }))
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/sms/send`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          message: smsMessage,
          from: undefined
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSms({ status: 'error', sending: false, result: body.error || 'Failed to send SMS.' })
        return
      }
      const s = body.sms || {}
      const note = s.sent !== undefined
        ? `Accepted ${s.sent} message(s) by the provider. ${s.failed ? s.failed + ' failed.' : ''} ${s.skipped ? s.skipped + ' skipped.' : ''} ${body.historyWarning || s.historyWarning || ''}`
        : 'Messages sent.'
      setSms({ status: 'success', sending: false, result: note })
      setShowSmsModal(false)
      setSmsConfirmation(false)
      fetchData()
    } catch (err) {
      console.error('SMS send error:', err)
      setSms({ status: 'error', sending: false, result: 'Unable to reach the SMS service.' })
    }
  }, [data, activeCampus, smsMessage, smsSegment, fetchData])

  const runAutoCampaign = async (recipientIds) => {
    setCampaign({ running: true, result: null, success: false })
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/retention/auto-campaign`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, recipient_ids: recipientIds, settings: campaignPreview?.settings })
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Campaign execution failed')
      const s = resData.sms || {}
      const note = `Auto-campaign complete! Eligible: ${resData.cohorts?.totalEligible || 0} (${resData.cohorts?.firstTimeFollowUpsCount || 0} first-visit follow-ups, ${resData.cohorts?.atRiskReengagementsCount || 0} win-backs). Excluded by cooldown: ${resData.cohorts?.excludedCooldown || 0}; opted out: ${resData.cohorts?.excludedOptOut || 0}; no longer eligible since preview: ${resData.cohorts?.excludedSincePreview || 0}. Provider accepted: ${s.sent ?? 0}, failed: ${s.failed ?? 0}, skipped: ${s.skipped ?? 0}. ${s.historyWarning || ''}`
      setCampaign({ running: false, result: note, success: s.skipped === 0 && s.failed === 0 })
      fetchData()
    } catch (err) {
      setCampaign({ running: false, result: err.message || 'Auto campaign failed', success: false })
    }
  }

  const smsRecipients = useMemo(() => {
    if (!data) return []
    return (data.records || []).filter((r) => r.phone && !r.sms_opt_out && (smsSegment === 'all' || r.status === smsSegment))
  }, [data, smsSegment])

  const textableCount = useMemo(() => {
    if (!data) return 0
    return (data.records || []).filter((r) => r.phone && !r.sms_opt_out).length
  }, [data])

  const saveRetentionSettings = async () => {
    setSettingsSaving(true)
    setSettingsFeedback('')
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/retention/settings`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(retentionSettings)
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to save campaign settings.')
      setRetentionSettings(body.settings)
      setSettingsFeedback('Drip messages and cooldown saved.')
    } catch (saveError) {
      setSettingsFeedback(saveError.message || 'Unable to save campaign settings.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const loadCampaignPreview = async () => {
    setCampaignPreviewLoading(true)
    setCampaignPreviewError('')
    setCampaignPreview(null)
    setShowCampaignModal(true)
    try {
      const response = await fetch(`${API_URL}/admin/retention/auto-campaign/preview`, {
        headers: getCampusAuthHeaders(activeCampus)
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to preview campaign.')
      setCampaignPreview(body)
    } catch (previewError) {
      setCampaignPreviewError(previewError.message || 'Unable to preview campaign.')
    } finally {
      setCampaignPreviewLoading(false)
    }
  }

  const scheduleCampaign = async () => {
    if (!scheduleAt) return
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/retention/schedules`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_at: new Date(`${scheduleAt}:00+00:00`).toISOString(),
          recipient_ids: campaignPreview?.recipients.map((recipient) => recipient.id),
          settings: campaignPreview?.settings
        })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to schedule campaign.')
      setCampaign({ running: false, result: `Campaign scheduled for ${new Date(body.schedule.run_at).toLocaleString('en-GH', { timeZone: 'Africa/Accra' })} Africa/Accra.`, success: true })
      setScheduleAt('')
      setShowCampaignModal(false)
      fetchData()
    } catch (scheduleError) {
      setCampaign({ running: false, result: scheduleError.message || 'Unable to schedule campaign.', success: false })
    }
  }

  const cancelSchedule = async (id) => {
    try {
      const response = await fetch(`${API_URL}/admin/retention/schedules/${id}`, {
        method: 'DELETE',
        headers: getCampusAuthHeaders(activeCampus)
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to cancel campaign.')
      fetchData()
    } catch (scheduleError) {
      setCampaign({ running: false, result: scheduleError.message || 'Unable to cancel campaign.', success: false })
    }
  }

  const updateSmsPreference = async (record) => {
    try {
      const response = await fetch(`${API_URL}/admin/students/${record.id}/sms-preference`, {
        method: 'POST',
        headers: { ...getCampusAuthHeaders(activeCampus), 'Content-Type': 'application/json' },
        body: JSON.stringify({ opted_out: !record.sms_opt_out })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to update SMS preference.')
      await fetchData()
    } catch (preferenceError) {
      setError(preferenceError.message || 'Unable to update SMS preference.')
    }
  }

  const rows = useMemo(() => {
    if (!data) return []
    let list = data.records || []
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(term) ||
          (r.phone || '').toLowerCase().includes(term)
      )
    }
    return list
  }, [data, statusFilter, searchTerm])

  if (loading && !data) {
    return <div className="admin-page-container"><div className="admin-loading-card">Loading retention data...</div></div>
  }

  if (!data) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">
          <p>{error || 'Unable to load retention data.'}</p>
          <button type="button" className="admin-btn admin-btn-primary" onClick={fetchData} style={{ marginTop: '12px' }}>Retry</button>
        </div>
      </div>
    )
  }

  const s = data.summary || {}

  const tiles = [
    { label: 'Total Registered', value: s.total ?? '--', icon: Users, tone: 'indigo' },
    { label: 'Returning', value: s.returning ?? '--', icon: Repeat, tone: 'emerald' },
    { label: 'New', value: s.new ?? '--', icon: UserPlus, tone: 'sky' },
    { label: 'At Risk', value: s.atRisk ?? '--', icon: AlertTriangle, tone: 'amber' },
    { label: 'Churned', value: s.churned ?? '--', icon: UserX, tone: 'rose' },
    { label: 'Returning Rate', value: `${s.returningRate ?? 0}%`, icon: TrendingUp, tone: 'violet' }
  ]

  const statusOptions = ['all', ...Object.keys(STATUS_META)]

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Retention & Patron Churn</h1>
          <p className="admin-page-subtitle">Who&apos;s returning, who&apos;s at risk, and automatic retention interventions</p>
        </div>
        <div className="admin-heading-actions">
          <button
            type="button"
            className="admin-btn"
            style={{ background: '#4f46e5', color: '#ffffff' }}
            onClick={loadCampaignPreview}
            disabled={campaign.running || campaignPreviewLoading}
            title="Preview first-visit follow-ups and win-back messages before sending or scheduling"
          >
            <Zap size={16} strokeWidth={2} />
            {campaignPreviewLoading ? 'Loading Preview...' : 'Plan Retention Campaign'}
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div className="admin-card-header">
          <div className="admin-card-title">
            <Zap size={18} strokeWidth={2} />
            <h2>Automatic Drip Messages</h2>
          </div>
          <span>Cooldown: {retentionSettings.cooldownDays} day(s)</span>
        </div>
        <div className="form-group">
          <label htmlFor="retention-first-followup">First-visit follow-up (3–7 days)</label>
          <textarea
            id="retention-first-followup"
            className="retention-sms-input"
            rows={3}
            maxLength={500}
            value={retentionSettings.firstTimeFollowUp}
            onChange={(event) => setRetentionSettings({ ...retentionSettings, firstTimeFollowUp: event.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="retention-winback">Win-back message (25–35 days since last visit)</label>
          <textarea
            id="retention-winback"
            className="retention-sms-input"
            rows={3}
            maxLength={500}
            value={retentionSettings.atRiskWinback}
            onChange={(event) => setRetentionSettings({ ...retentionSettings, atRiskWinback: event.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="retention-cooldown">Repeat-send cooldown (days)</label>
          <input
            id="retention-cooldown"
            className="retention-sms-input"
            type="number"
            min="1"
            max="90"
            step="1"
            value={retentionSettings.cooldownDays}
            onChange={(event) => setRetentionSettings({ ...retentionSettings, cooldownDays: Number(event.target.value) })}
          />
        </div>
        <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px' }}>
          Use <code>{'{name}'}</code> and <code>{'{campus}'}</code>. Saved members remain eligible unless an admin opts them out. Recent accepted manual or drip messages are included in the cooldown.
        </p>
        <button type="button" className="admin-btn admin-btn-primary" onClick={saveRetentionSettings} disabled={settingsSaving}>
          {settingsSaving ? 'Saving...' : 'Save Drip Settings'}
        </button>
        {settingsFeedback && <span role="status" style={{ marginLeft: '12px', fontSize: '13px' }}>{settingsFeedback}</span>}
      </div>

      <div className="admin-card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div className="admin-card-header">
          <div className="admin-card-title">
            <MessageSquare size={18} strokeWidth={2} />
            <h2>SMS Broadcast</h2>
          </div>
          <span>
            {textableCount} SMS-eligible; {smsServiceStatus?.sms?.configured ? 'SMS service ready' : 'SMS service not configured'}
          </span>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => {
            setSmsSegment('')
            setSmsConfirmation(false)
            setShowSmsModal(true)
          }}
          disabled={textableCount === 0 || !smsServiceStatus?.sms?.configured}
          title={!smsServiceStatus?.sms?.configured ? 'Configure the SMS provider on the server first' : textableCount === 0 ? 'No members with phone numbers to text' : 'Choose a member section and compose an SMS'}
        >
          <MessageSquare size={16} strokeWidth={2} />
          Send SMS
        </button>
      </div>

      {showSmsModal && (
        <div className="modal-overlay" onClick={() => !sms.sending && setShowSmsModal(false)}>
          <div
            className="modal admin-modal admin-modal-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="retention-sms-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h3 id="retention-sms-title">Send an SMS</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setShowSmsModal(false)}
                disabled={sms.sending}
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <p className="admin-modal-subtitle">Choose who should receive the message and review it before sending.</p>
            <div className="form-group">
              <label htmlFor="retention-sms-segment">Section of people</label>
              <select
                className="retention-sms-input"
                id="retention-sms-segment"
                value={smsSegment}
                onChange={(event) => setSmsSegment(event.target.value)}
              >
                <option value="">Select a section</option>
                <option value="all">All members ({textableCount} SMS-eligible)</option>
                {Object.entries(STATUS_META).map(([status, meta]) => {
                  const count = (data.records || []).filter((record) => record.status === status && record.phone && !record.sms_opt_out).length
                  return <option key={status} value={status}>{meta.label} ({count} SMS-eligible)</option>
                })}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="retention-sms-message">Message</label>
              <textarea
                className="retention-sms-input"
                id="retention-sms-message"
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Write the SMS message"
                style={{ minHeight: '110px', resize: 'vertical' }}
              />
            </div>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>
              {smsSegment
                ? `${smsRecipients.length} recipient${smsRecipients.length === 1 ? '' : 's'} with a phone number. `
                : 'Select a section to see the number of recipients. '}
              Personalize with <code>{'{name}'}</code> and <code>{'{campus}'}</code>.
              {smsSegment && smsRecipients[0] && (
                <> Preview: {smsMessage.replaceAll('{name}', smsRecipients[0].name || 'there').replaceAll('{campus}', smsRecipients[0].campus || activeCampus)}</>
              )}
            </p>
            {smsConfirmation && (
              <div className="admin-card" style={{ marginBottom: '16px', padding: '12px' }}>
                <strong>Review recipients before sending ({smsRecipients.length})</strong>
                <div className="admin-table-scroll" style={{ maxHeight: '180px', marginTop: '8px' }}>
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Phone</th><th>Section</th><th>Personalized message</th></tr></thead>
                    <tbody>
                      {smsRecipients.map((recipient) => (
                        <tr key={recipient.id}>
                          <td>{recipient.name || '—'}</td>
                          <td>{maskPhone(recipient.phone)}</td>
                          <td>{statusInfo(recipient.status).label}</td>
                          <td>{smsMessage.replaceAll('{name}', recipient.name || 'there').replaceAll('{campus}', recipient.campus || activeCampus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '12px' }}>
                  Members marked opted out are excluded. Delivery confirmation depends on provider callback setup.
                </p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="admin-btn" onClick={() => { setShowSmsModal(false); setSmsConfirmation(false) }} disabled={sms.sending}>
                Cancel
              </button>
              {!smsConfirmation ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => setSmsConfirmation(true)}
                  disabled={!smsSegment || smsRecipients.length === 0 || !smsMessage.trim()}
                >
                  Review Recipients ({smsRecipients.length})
                </button>
              ) : (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={sendEngagementSms}
                disabled={sms.sending || !smsSegment || smsRecipients.length === 0 || !smsMessage.trim()}
              >
                {sms.sending ? <Send size={16} strokeWidth={2} className="admin-spin" /> : <MessageSquare size={16} strokeWidth={2} />}
                {sms.sending ? 'Sending...' : `Confirm & Send (${smsRecipients.length})`}
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCampaignModal && (
        <div className="modal-overlay" onClick={() => !campaign.running && setShowCampaignModal(false)}>
          <div className="modal admin-modal admin-modal-lg" role="dialog" aria-modal="true" aria-labelledby="retention-campaign-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 id="retention-campaign-title">Review Retention Campaign</h3>
              <button type="button" className="admin-modal-close" onClick={() => setShowCampaignModal(false)} disabled={campaign.running} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="admin-modal-subtitle">Review eligible members and personalized messages. A scheduled run recalculates eligibility and opt-outs when it executes.</p>
            {campaignPreviewLoading && <p>Loading eligible members…</p>}
            {campaignPreviewError && <p className="admin-alert admin-alert-error">{campaignPreviewError}</p>}
            {campaignPreview && (
              <>
                {!smsServiceStatus?.sms?.configured && (
                  <p className="admin-alert admin-alert-error">SMS is not configured right now. You can save a scheduled run, but it will skip sending unless the provider is configured when it executes.</p>
                )}
                <p>
                  {campaignPreview.cohorts.totalEligible} eligible; {campaignPreview.cohorts.excludedCooldown} excluded by the {campaignPreview.cooldownDays}-day cooldown; {campaignPreview.cohorts.excludedOptOut} opted out.
                </p>
                <div className="admin-table-scroll" style={{ maxHeight: '280px' }}>
                  <table className="admin-table">
                    <thead><tr><th>Member</th><th>Phone</th><th>Group</th><th>Last visit</th><th>Personalized message</th></tr></thead>
                    <tbody>
                      {campaignPreview.recipients.map((recipient) => (
                        <tr key={recipient.id}>
                          <td>{recipient.name || '—'}</td>
                          <td>{recipient.phone}</td>
                          <td>{recipient.source === 'first-time-followup' ? 'First visit' : 'Win-back'}</td>
                          <td>{recipient.days_since_last} day(s) ago</td>
                          <td>{recipient.message}</td>
                        </tr>
                      ))}
                      {campaignPreview.recipients.length === 0 && <tr><td colSpan="5">No eligible members right now.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label htmlFor="retention-schedule-time">Schedule for later (Africa/Accra time)</label>
                  <input
                    id="retention-schedule-time"
                    className="retention-sms-input"
                    type="datetime-local"
                    value={scheduleAt}
                    min={formatAccraDateTimeInput(new Date(Date.now() + 60_000))}
                    onChange={(event) => setScheduleAt(event.target.value)}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="admin-btn" onClick={() => setShowCampaignModal(false)} disabled={campaign.running}>Close</button>
                  <button type="button" className="admin-btn" onClick={scheduleCampaign} disabled={!scheduleAt || !campaignPreview.recipients.length || campaign.running}>Schedule</button>
                  <button type="button" className="admin-btn admin-btn-primary" onClick={async () => { await runAutoCampaign(campaignPreview.recipients.map((recipient) => recipient.id)); setShowCampaignModal(false) }} disabled={!campaignPreview.recipients.length || !smsServiceStatus?.sms?.configured || campaign.running}>
                    {campaign.running ? 'Sending…' : `Confirm & Send Now (${campaignPreview.recipients.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {campaign.result && (
        <div className={`admin-alert admin-alert-${campaign.success ? 'success' : 'error'}`}>
          {campaign.result}
        </div>
      )}

      {sms.result && (
        <div className={`admin-alert admin-alert-${sms.status}`}>
          {sms.result}
        </div>
      )}

      <div className="admin-card" style={{ marginBottom: '24px' }}>
        <div className="admin-card-header">
          <div className="admin-card-title"><Repeat size={18} /><h2>Scheduled Retention Campaigns</h2></div>
          <span>Times shown in Africa/Accra</span>
        </div>
        {schedules.length === 0 ? (
          <div className="admin-empty-state"><p>No scheduled campaigns.</p></div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>Scheduled time</th><th>Campus</th><th>Recipients</th><th>Status</th><th>Result</th><th>Action</th></tr></thead>
              <tbody>
                {schedules.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.run_at).toLocaleString('en-GH', { timeZone: 'Africa/Accra' })}</td>
                    <td>{item.campus}</td>
                    <td>{item.recipient_ids?.length ?? 0}</td>
                    <td>{item.status}</td>
                    <td>{item.result?.sms ? `Accepted ${item.result.sms.sent}; failed ${item.result.sms.failed}; skipped ${item.result.sms.skipped}` : item.result?.error || '—'}</td>
                    <td>{item.status === 'scheduled' && (
                      <button type="button" className="admin-btn admin-btn-sm" onClick={() => cancelSchedule(item.id)}>Cancel</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: '24px' }}>
        <div className="admin-card-header">
          <div className="admin-card-title"><TrendingUp size={18} /><h2>Campaign Outcomes (Last 90 Days)</h2></div>
          <span>Returns are members with a verified visit after an accepted campaign SMS.</span>
        </div>
        <div className="admin-stats-grid">
          {[
            ['Provider accepted', campaignAnalytics?.totals?.accepted ?? '—'],
            ['Provider failed', campaignAnalytics?.totals?.failed ?? '—'],
            ['Delivery confirmed', campaignAnalytics?.totals?.delivered ?? '—'],
            ['Delivery failed', campaignAnalytics?.totals?.deliveryFailed ?? '—'],
            ['Return events after SMS', campaignAnalytics?.totals?.returnedAfterSend ?? '—']
          ].map(([label, value]) => (
            <div className="admin-stat-card admin-stat-indigo" key={label}>
              <div className="admin-stat-meta"><span className="admin-stat-label">{label}</span><span className="admin-stat-value">{value}</span></div>
            </div>
          ))}
        </div>
        {!campaignAnalytics?.totals?.delivered && (
          <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: '13px' }}>
            Delivery totals stay at zero until your provider or webhook relay posts authenticated delivery callbacks.
          </p>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: '24px' }}>
        <div className="admin-card-header">
          <div className="admin-card-title">
            <Send size={18} strokeWidth={2} />
            <h2>SMS Send History</h2>
          </div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            Provider acceptance is shown here; final handset delivery is not confirmed.
          </span>
        </div>
        {smsHistoryError && <p className="admin-alert admin-alert-error">{smsHistoryError}</p>}
        {!smsHistoryError && smsHistory.length === 0 ? (
          <div className="admin-empty-state"><p>No SMS attempts recorded for this campus yet.</p></div>
        ) : smsHistory.length > 0 ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr><th>Time</th><th>Recipient</th><th>Number</th><th>Source</th><th>Provider</th><th>Accepted</th><th>Delivery</th><th>Details</th></tr>
              </thead>
              <tbody>
                {smsHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>{item.recipient_name || '—'}</td>
                    <td>{item.recipient_phone_masked}</td>
                    <td>{item.source}</td>
                    <td>{item.provider || '—'}</td>
                    <td>{item.status}</td>
                    <td>{item.delivery_status || (item.status === 'accepted' ? 'Awaiting provider callback' : '—')}</td>
                    <td>{item.error || (item.status === 'accepted' ? 'Accepted by provider; handset delivery is not confirmed unless a callback arrives.' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="admin-stats-grid admin-stats-grid-4">
        {tiles.map((tile) => (
          <div key={tile.label} className={`admin-stat-card admin-stat-${tile.tone}`}>
            <div className="admin-stat-icon">
              <tile.icon size={22} strokeWidth={2} />
            </div>
            <div className="admin-stat-meta">
              <span className="admin-stat-label">{tile.label}</span>
              <span className="admin-stat-value">{tile.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Patron Experience & Facility Feedback Card */}
      {feedback && (
        <div className="admin-card" style={{ marginBottom: '24px' }}>
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Star size={18} strokeWidth={2} style={{ color: '#eab308' }} />
              <h2>Patron Facility Satisfaction & Feedback</h2>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {feedback.total} total ratings • Average: <strong>{feedback.avgRating} / 5.0 ⭐</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', padding: '16px' }}>
            {/* Rating Stars Breakdown */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Rating Distribution</h4>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = feedback.ratingsBreakdown?.[stars] || 0
                const pct = feedback.total ? Math.round((count / feedback.total) * 100) : 0
                return (
                  <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12.5px' }}>
                    <span style={{ width: '45px', fontWeight: 600 }}>{stars} ★</span>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: stars >= 4 ? '#10b981' : stars === 3 ? '#f59e0b' : '#ef4444', height: '100%' }} />
                    </div>
                    <span style={{ width: '32px', textAlign: 'right', color: '#64748b' }}>{count}</span>
                  </div>
                )
              })}
            </div>

            {/* Top Categories */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Facility Experience Tags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(feedback.categoryBreakdown || {}).map(([cat, count]) => (
                  <span
                    key={cat}
                    style={{
                      background: '#f1f5f9',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155'
                    }}
                  >
                    {cat} ({count})
                  </span>
                ))}
                {Object.keys(feedback.categoryBreakdown || {}).length === 0 && (
                  <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: 0 }}>No category tags submitted yet.</p>
                )}
              </div>
            </div>

            {/* Recent Comments */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Recent Patron Comments</h4>
              <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                {(feedback.recent || []).filter((f) => f.comment).slice(0, 3).map((f) => (
                  <div key={f.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#eab308' }}>{'★'.repeat(f.rating)}</span>
                    <span style={{ marginLeft: '6px', color: '#64748b' }}>{f.category}</span>
                    <p style={{ margin: '4px 0 0', color: '#1e293b' }}>&ldquo;{f.comment}&rdquo;</p>
                  </div>
                ))}
                {(!feedback.recent || feedback.recent.filter((f) => f.comment).length === 0) && (
                  <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: 0 }}>No written comments yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <Repeat size={18} strokeWidth={2} />
            <h2>Member Activity Breakdown</h2>
          </div>
        </div>
        <div className="admin-retention-bar">
          {statusOptions.filter((x) => x !== 'all').map((status) => {
            const meta = statusInfo(status)
            const count = s[status] ?? 0
            const pct = s.total ? Math.round((count / s.total) * 100) : 0
            return (
              <div className="admin-retention-seg" key={status}>
                <span className="admin-retention-dot" style={{ background: meta.color }} />
                <span className="admin-retention-seg-label">{meta.label}</span>
                <span className="admin-retention-seg-count">{count}</span>
                <div className="admin-retention-track">
                  <div className="admin-retention-bar" style={{ width: `${pct}%`, background: meta.color }} />
                </div>
                <span className="admin-retention-seg-pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="admin-toolbar-row">
        <div className="admin-search">
          <Search size={16} strokeWidth={2} />
          <input
            type="text"
            placeholder="Search members by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="admin-filter-chips">
          {statusOptions.map((status) => {
            const label = status === 'all' ? 'All' : statusInfo(status).label
            const active = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                className={`admin-filter-chip${active ? ' active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty-state">
          <Users size={30} strokeWidth={1.5} />
          <p>{searchTerm ? 'No matching members' : 'No members recorded yet'}</p>
        </div>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Purpose</th>
                <th>Visits</th>
                <th>Last Visit</th>
                <th>Days Since</th>
                <th>Status</th>
                <th>Activity reason</th>
                <th>SMS preference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = statusInfo(r.status)
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="admin-cell-strong">{r.name}</span>
                    </td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.purpose || '—'}</td>
                    <td>{r.visit_count}</td>
                    <td>{formatDate(r.last_visit)}</td>
                    <td>{r.days_since_last != null ? `${r.days_since_last}d` : '—'}</td>
                    <td>
                      <span className="admin-status-pill" style={{ color: meta.color, background: `${meta.color}1a`, borderColor: `${meta.color}40` }}>
                        <span className="admin-status-dot" style={{ background: meta.color }}></span>
                        {meta.label}
                      </span>
                    </td>
                    <td>{retentionReason(r)}</td>
                    <td>
                      <button
                        type="button"
                        className={`admin-btn admin-btn-sm ${r.sms_opt_out ? 'admin-btn-warning' : 'admin-btn-outline'}`}
                        onClick={() => updateSmsPreference(r)}
                        title={r.sms_opt_out ? 'Allow this member to receive SMS' : 'Exclude this member from all SMS campaigns'}
                      >
                        {r.sms_opt_out ? 'Opted out' : 'SMS enabled'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Retention
