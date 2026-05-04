import { PaymentService } from '../services/payment.service.js';

const paymentService = new PaymentService();

export const createOrder = async (req, res, next) => {
  try {
    const { requestId } = req.body;
    const data = await paymentService.createOrder(requestId, req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.verifyPayment(req.body);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
};

export const getPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentByRequest(req.params.requestId, req.user.id);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
};
