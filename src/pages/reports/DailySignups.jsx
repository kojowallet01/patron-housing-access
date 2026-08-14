import ReportView from './ReportView'

export default function DailySignups() {
  return (
    <ReportView
      range="day"
      title="Daily Signups"
      subtitle="Today’s visitor signups and check-ins"
    />
  )
}
