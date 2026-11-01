// While a company is closing its year (copying the database + emptying orders) no order may be written.
const locked = new Set();
const isLocked = (companyId) => locked.has(Number(companyId));
const lock = (companyId) => locked.add(Number(companyId));
const unlock = (companyId) => locked.delete(Number(companyId));

// Express guard: blocks everything except GET while the company is locked
const guard = (req, res, next) => {
  if (req.method !== 'GET' && req.company && isLocked(req.company.id)) {
    return res.status(503).json({ error: 'The store is closing the year right now. Please try again in a minute.' });
  }
  return next();
};

module.exports = { isLocked, lock, unlock, guard };
