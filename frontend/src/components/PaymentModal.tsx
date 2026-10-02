'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { paymentAPI } from '@/services/api';
import { formatCurrency } from '@/utils/formatTime';
import type { RootState } from '@/store';

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
  const user = useSelector((state: RootState) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.Razorpay) {
      setReady(true);
    } else {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setReady(true);
      script.onerror = () => setError('Secure checkout could not be loaded. Check your connection and try again.');
      document.body.appendChild(script);
    }
  }, []);

  const handlePayment = async () => {
    if (!ready || !window.Razorpay) return setError('Secure checkout is still loading. Please try again in a moment.');
    setLoading(true);
    setError('');
    try {
      const { data } = await paymentAPI.createOrder(requestId);
      const order = data.data;

      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: 'zoon',
        description: 'Home Service Payment',
        order_id: order.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay with any UPI app',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi', 'card', 'netbanking', 'wallet'],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (response: any) => {
          try {
            await paymentAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              requestId,
            });
            setLoading(false);
            onSuccess();
          } catch {
            setLoading(false);
            setError('Payment verification failed. Please contact support.');
          }
        },
        theme: { color: '#2563eb' },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        setLoading(false);
        setError(response?.error?.description || 'Payment was not completed. Choose another UPI app or try again.');
      });
      rzp.open();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl overflow-hidden">

        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--text)] text-base sm:text-lg">Complete Payment</h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">UPI-first secure payment via Razorpay</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--soft)] hover:bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--text)]"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="bg-gradient-to-br from-[#2563eb]/10 to-[#0d9488]/5 border border-[#2563eb]/20 rounded-xl p-4 mb-4 text-center">
            <p className="text-[var(--muted)] text-xs mb-1">Service Amount</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text)]">{formatCurrency(amount)}</p>
          </div>

          {error && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-2 mb-4 text-[11px] sm:text-xs text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <span className="text-[var(--brand)]">✓</span>
              <span>SSL-secured payment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--brand)]">✓</span>
              <span>Opens Google Pay, PhonePe, Paytm, or another UPI app on mobile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--brand)]">✓</span>
              <span>Instant confirmation</span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading || !ready}
            className="w-full py-3 bg-gradient-to-r from-[#2563eb] to-[#0d9488] hover:from-[#3b82f6] hover:to-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading || !ready ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{ready ? 'Processing…' : 'Loading checkout…'}</span>
              </>
            ) : (
              <>
                <span>💳</span>
                <span>Pay with UPI · {formatCurrency(amount)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
