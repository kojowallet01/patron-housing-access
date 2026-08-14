import ReportView from './ReportView'

export default function MonthlySignups() {
  return (
    <ReportView
      range="month"
      title="Monthly Signups"
      subtitle="Visitor signups for the current month"
    />
  )
}
