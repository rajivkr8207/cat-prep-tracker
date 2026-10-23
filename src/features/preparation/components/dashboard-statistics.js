import {
  CheckCircle2,
  Flame,
  Pencil,
  Target,
  TrendingUp,
} from "lucide-react";

export function DashboardStatistics({ totals, accuracy, completion }) {
  return (
    <section aria-label="Daily statistics" className="stats-grid">
      <article className="stat-card stat-lime">
        <div className="stat-top"><span>PLANNED</span><span className="stat-icon"><Target size={19} /></span></div>
        <strong>{totals.planned}</strong>
        <span className="stat-caption">questions on the plan</span>
        <div className="stat-bottom"><span>ACTUAL</span><b>{totals.actual}</b></div>
      </article>
      <article className="stat-card">
        <div className="stat-top"><span>ATTEMPTED</span><span className="stat-icon coral-icon"><Pencil size={17} /></span></div>
        <strong>{totals.attempted}</strong>
        <span className="stat-caption">questions attempted</span>
        <div className="stat-bottom"><span>CORRECT</span><b>{totals.correct}</b></div>
      </article>
      <article className="stat-card stat-purple">
        <div className="stat-top"><span>ACCURACY</span><span className="stat-icon"><TrendingUp size={18} /></span></div>
        <strong>{accuracy}<small>%</small></strong>
        <span className="stat-caption">correct out of attempted</span>
        <div className="meter"><span style={{ width: `${accuracy}%` }} /></div>
      </article>
      <article className="stat-card">
        <div className="stat-top"><span>COMPLETION</span><span className="stat-icon coral-icon"><CheckCircle2 size={18} /></span></div>
        <strong>{completion}<small>%</small></strong>
        <span className="stat-caption">actual vs. planned questions</span>
        <div className="meter meter-coral"><span style={{ width: `${completion}%` }} /></div>
      </article>
    </section>
  );
}

export function ProgressInsights({ chartDays, chartMax, streak, activeDate }) {
  return (
    <section className="insights-grid" id="analytics">
      <article className="panel chart-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">THE WORK ADDS UP</span><h2>Your last 7 days</h2></div>
          <span className="chart-total">
            <TrendingUp size={16} /> {chartDays.reduce((sum, day) => sum + day.actual, 0)} <small>questions</small>
          </span>
        </div>
        <div
          aria-label="Actual questions completed each day in the last seven days"
          className="chart"
          role="img"
        >
          <div className="chart-grid"><span>{chartMax}</span><span>{Math.round(chartMax / 2)}</span><span>0</span></div>
          <div className="chart-bars">
            {chartDays.map((day) => (
              <div className="chart-day" key={day.date}>
                <div className="chart-bar-wrap">
                  <span className="chart-value">{day.actual || ""}</span>
                  <span
                    className={`chart-bar${day.date === activeDate ? " chart-bar-selected" : ""}`}
                    style={{ height: `${Math.max(day.actual ? (day.actual / chartMax) * 100 : 0, day.actual ? 8 : 3)}%` }}
                  />
                </div>
                <span className="chart-day-label">{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      </article>
      <article className="panel streak-panel">
        <div className="streak-illustration"><Flame aria-hidden="true" size={29} strokeWidth={2.1} /></div>
        <span className="eyebrow">KEEP THE MOMENTUM</span>
        <div className="streak-count">{streak}<span>{streak === 1 ? "day" : "days"}</span></div>
        <p>{streak ? "You’ve been showing up. That matters." : "Start your streak with one study session today."}</p>
        <div className="streak-divider" />
        <div className="streak-foot"><span>YOUR LONGEST RUN IS STILL AHEAD.</span><span aria-hidden="true">→</span></div>
      </article>
    </section>
  );
}
