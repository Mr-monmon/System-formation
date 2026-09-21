/**
 * Savings estimator — deliberately conservative, and never a quote.
 *
 * The model is intentionally simple so it can be explained on a call:
 *
 *   baseline        = analysts x ANALYST_MONTHLY_COST + monthly licence spend
 *   licence saving  = licence spend x LICENCE_RATE        (pooled, multi-tenant terms)
 *   people saving   = people cost  x COVERAGE_RATE        (shift cover is where pooling helps most)
 *   overhead saving = people cost  x OVERHEAD_RATE        (recruitment, training, attrition cover)
 *
 * The total is expressed as a RANGE whose lower bound is 65% of the modelled
 * figure, and the whole thing is hard-capped at 60% of baseline so the widget
 * can never promise more than the claim the company makes in writing.
 *
 * ANALYST_MONTHLY_COST is a placeholder: confirm it before launch. It is shown
 * to the visitor in the UI rather than hidden in the maths.
 */
export const ASSUMPTIONS = {
  /** Fully loaded monthly cost of one analyst, in SAR. [ANALYST COST] — confirm. */
  ANALYST_MONTHLY_COST: 25_000,
  LICENCE_RATE: 0.3,
  COVERAGE_RATE: { business: 0.3, '247': 0.4 } as const,
  OVERHEAD_RATE: 0.08,
  /** The company only ever claims "up to 60%". */
  MAX_RATE: 0.6,
  /** Lower bound of the displayed range, as a share of the modelled saving. */
  RANGE_FLOOR: 0.65,
} as const;

export interface EstimatorInput {
  analysts: number;
  licenceSpend: number;
  coverage: 'business' | '247';
}

export interface EstimatorResult {
  baseline: number;
  low: number;
  high: number;
  lowRate: number;
  highRate: number;
}

export function estimate({ analysts, licenceSpend, coverage }: EstimatorInput): EstimatorResult {
  const people = Math.max(0, analysts) * ASSUMPTIONS.ANALYST_MONTHLY_COST;
  const licences = Math.max(0, licenceSpend);
  const baseline = people + licences;
  if (baseline <= 0) return { baseline: 0, low: 0, high: 0, lowRate: 0, highRate: 0 };

  const modelled =
    licences * ASSUMPTIONS.LICENCE_RATE +
    people * ASSUMPTIONS.COVERAGE_RATE[coverage] +
    people * ASSUMPTIONS.OVERHEAD_RATE;

  const high = Math.min(modelled, baseline * ASSUMPTIONS.MAX_RATE);
  const low = high * ASSUMPTIONS.RANGE_FLOOR;

  return { baseline, low, high, lowRate: low / baseline, highRate: high / baseline };
}

export function mountEstimator(): void {
  const root = document.querySelector<HTMLFormElement>('[data-estimator]');
  if (!root) return;

  const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  // Western Arabic digits in both languages, for consistency with the phone
  // number and the published figures.
  const money = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    maximumFractionDigits: 0,
  });
  const percent = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    style: 'percent',
    maximumFractionDigits: 0,
  });

  const analysts = root.querySelector<HTMLInputElement>('[name="analysts"]')!;
  const licence = root.querySelector<HTMLInputElement>('[name="licence"]')!;
  const analystsOut = root.querySelector<HTMLOutputElement>('[data-out="analysts"]');
  const licenceOut = root.querySelector<HTMLOutputElement>('[data-out="licence"]');
  const rangeOut = root.querySelector<HTMLElement>('[data-out="range"]')!;
  const rateOut = root.querySelector<HTMLElement>('[data-out="rate"]')!;
  const baselineOut = root.querySelector<HTMLElement>('[data-out="baseline"]')!;

  const update = () => {
    const coverage =
      (root.querySelector<HTMLInputElement>('[name="coverage"]:checked')?.value as
        | 'business'
        | '247') ?? 'business';
    const result = estimate({
      analysts: Number(analysts.value) || 0,
      licenceSpend: Number(licence.value) || 0,
      coverage,
    });

    if (analystsOut) analystsOut.value = money.format(Number(analysts.value) || 0);
    if (licenceOut) licenceOut.value = money.format(Number(licence.value) || 0);

    rangeOut.textContent = `${money.format(Math.round(result.low / 500) * 500)} – ${money.format(
      Math.round(result.high / 500) * 500,
    )}`;
    rateOut.textContent = `${percent.format(result.lowRate)} – ${percent.format(result.highRate)}`;
    baselineOut.textContent = money.format(Math.round(result.baseline / 500) * 500);
  };

  root.addEventListener('input', update);
  root.addEventListener('change', update);
  root.addEventListener('submit', (e) => e.preventDefault());
  update();
}
