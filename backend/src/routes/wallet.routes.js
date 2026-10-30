const router     = require('express').Router();
const { authenticate } = require('../middleware/auth');
const wallet     = require('../controllers/wallet.controller');

router.get('/balance',      authenticate, wallet.getBalance);
router.get('/transactions', authenticate, wallet.getTransactions);
router.post('/topup',       authenticate, wallet.topUp);

module.exports = router;
