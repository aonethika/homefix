'use client';
import { useState, useEffect } from 'react';
import { paymentAPI } from '@/services/api';
import { formatCurrency } from '@/utils/formatTime';

interface Props {
  requestId: string;
  amount: number;
  onSuccess: () => void;
  onClose: () => void;
}

declare global {
  interface Window { Razorpay: any; }
}

export default function PaymentModal({ requestId, amount, onSuccess, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
    }
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await paymentAPI.createOrder(requestId);
      const order = data.data;

      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: 'HomeFix',
        description: 'Home Service Payment',
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await paymentAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              requestId,
            });
            onSuccess();
          } catch {
            setError('Payment verification failed. Please contact support.');
          }
        },
        prefill: {},
        theme: { color: '#418e4d' },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-sm bg-[#18181b] border border-[#2a2a30] rounded-t-2xl sm:rounded-2xl overflow-hidden">

        <div className="p-4 sm:p-5 border-b border-[#2a2a30] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base sm:text-lg">Complete Payment</h3>
            <p className="text-[11px] text-[#a8a29e] mt-0.5">Secure payment via Razorpay</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2a2a30] hover:bg-[#3a3a40] text-[#a8a29e] hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="bg-gradient-to-br from-[#418e4d]/10 to-[#357a41]/5 border border-[#418e4d]/20 rounded-xl p-4 mb-4 text-center">
            <p className="text-[#a8a29e] text-xs mb-1">Service Amount</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{formatCurrency(amount)}</p>
          </div>

          {error && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-2 mb-4 text-[11px] sm:text-xs text-[#a8a29e]">
            <div className="flex items-center gap-2">
              <span className="text-[#6ee7b7]">✓</span>
              <span>SSL-secured payment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6ee7b7]">✓</span>
              <span>UPI, Cards, Net Banking</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6ee7b7]">✓</span>
              <span>Instant confirmation</span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#418e4d] to-[#357a41] hover:from-[#4fa65b] hover:to-[#3f8c4b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>💳</span>
                <span>Pay {formatCurrency(amount)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}