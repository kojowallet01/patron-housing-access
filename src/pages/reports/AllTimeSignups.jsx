import ReportView from './ReportView'

export default function AllTimeSignups() {
  return (
    <ReportView
      range="all"
      title="All-Time Signups"
      subtitle="Every recorded visitor check-in to date"
    />
  )
}
