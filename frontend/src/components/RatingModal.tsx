'use client';
import { useState } from 'react';
import { ratingAPI } from '@/services/api';

interface Props {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function RatingModal({ requestId, onSuccess, onClose }: Props) {
  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  const handleSubmit = async () => {
    if (!score) return setError('Please select a rating');
    setLoading(true);
    try {
      await ratingAPI.submit({ requestId, score, comment });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-sm bg-[#18181b] border border-[#2a2a30] rounded-t-2xl sm:rounded-2xl overflow-hidden">

        <div className="p-4 sm:p-5 border-b border-[#2a2a30] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base sm:text-lg">Rate Your Experience</h3>
            <p className="text-[11px] text-[#a8a29e] mt-0.5">Your feedback matters</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2a2a30] hover:bg-[#3a3a40] text-[#a8a29e]"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-5">
          
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setScore(s)}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                className="text-2xl sm:text-3xl transition-transform active:scale-90"
              >
                <span className={s <= (hovered || score) ? 'opacity-100' : 'opacity-20'}>⭐</span>
              </button>
            ))}
          </div>

          {(score || hovered) > 0 && (
            <p className="text-center text-xs sm:text-sm text-[#6ee7b7] font-medium mb-3">
              {labels[hovered || score]}
            </p>
          )}

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share your experience (optional)..."
            rows={3}
            className="w-full bg-[#0f0f10] border border-[#2a2a30] rounded-xl px-3 py-2 text-sm text-white placeholder-[#57534e] focus:outline-none focus:border-[#418e4d] resize-none mb-3"
          />

          {error && (
            <p className="text-red-400 text-xs mb-2">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !score}
            className="w-full py-3 bg-gradient-to-r from-[#418e4d] to-[#357a41] hover:from-[#4fa65b] hover:to-[#3f8c4b] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Submitting...' : '⭐ Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}