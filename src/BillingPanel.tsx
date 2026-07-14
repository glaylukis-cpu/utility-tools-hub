import { getCurrentPlan, getFeaturesForBillingComparison, proPlanned } from "./planFeatures";
import "./BillingPanel.css";

export default function BillingPanel() {
  const plan = getCurrentPlan();
  const billingFeatures = getFeaturesForBillingComparison();

  return (
    <section className="billing-panel" aria-labelledby="billing-panel-title">
      <div className="page-header">
        <h1 id="billing-panel-title">Billing</h1>
        <p>Billing controls are planned. No paid plan can be purchased at this time.</p>
      </div>

      <div className="card billing-status-card">
        <h2>Billing status</h2>
        <dl className="billing-status-list">
          <div>
            <dt>Current plan</dt>
            <dd>{plan.label}</dd>
          </div>
          <div>
            <dt>Billing status</dt>
            <dd>Not available yet</dd>
          </div>
          <div>
            <dt>Pro plan</dt>
            <dd>Planned</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>TBD</dd>
          </div>
          <div>
            <dt>Checkout</dt>
            <dd>Planned</dd>
          </div>
          <div>
            <dt>Customer Portal</dt>
            <dd>Planned</dd>
          </div>
        </dl>
      </div>

      <div className="billing-plan-grid" aria-label="Plan comparison">
        <article className="card billing-plan-card billing-current-plan">
          <div className="billing-plan-heading">
            <div>
              <span className="billing-plan-eyebrow">Current plan</span>
              <h2>{plan.label}</h2>
            </div>
            <span className="billing-plan-badge billing-plan-badge-current">Available now</span>
          </div>
          <p>Use the currently available local desktop tools without a paid account.</p>
          <ul className="billing-feature-list">
            {billingFeatures.freePreview.map((feature) => (
              <li key={feature.id}>{feature.label}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-disabled" disabled>
            Current plan
          </button>
        </article>

        <article className="card billing-plan-card">
          <div className="billing-plan-heading">
            <div>
              <span className="billing-plan-eyebrow">Future option</span>
              <h2>{proPlanned.label}</h2>
            </div>
            <span className="billing-plan-badge">Price: TBD</span>
          </div>
          <p>Pro is not available for purchase yet. Features and pricing may change.</p>
          <ul className="billing-feature-list">
            {billingFeatures.proPlanned.map((feature) => (
              <li key={feature.id}>{feature.label}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-disabled" disabled>
            Start Pro (Planned)
          </button>
        </article>
      </div>

      <div className="card billing-management-card">
        <div>
          <h2>Billing management</h2>
          <p>Stripe Checkout and Customer Portal are not implemented. This screen does not open a payment page or send billing data.</p>
        </div>
        <button type="button" className="btn btn-disabled" disabled>
          Manage billing (Planned)
        </button>
      </div>
    </section>
  );
}
