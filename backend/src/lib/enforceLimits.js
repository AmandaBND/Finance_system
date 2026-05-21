const { checkLimit } = require('./planLimits');

function enforceLimit(plan, limitKey, currentCount, resourceLabel) {
  const result = checkLimit(plan, limitKey, currentCount);
  if (!result.allowed) {
    const err = new Error(
      `${resourceLabel} limit reached for your plan. ` +
      `Your ${plan} plan allows ${result.limit === Infinity ? 'unlimited' : result.limit}. ` +
      `Upgrade to add more.`
    );
    err.code = 'PLAN_LIMIT_EXCEEDED';
    err.limitKey = limitKey;
    err.plan = plan;
    err.limit = result.limit;
    err.current = result.current;
    throw err;
  }
}

module.exports = { enforceLimit };
