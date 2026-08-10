import React from 'react'
import ReportView from './ReportView'

export default function WeeklySignups() {
  return (
    <ReportView
      range="week"
      title="Weekly Signups"
      subtitle="Visitors signed in over the past week"
    />
  )
}
