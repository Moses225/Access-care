import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface Booking {
  id: string;
  userId: string;
  patientName: string;
  providerName: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  visitTypeLabel?: string;
  serviceCategoryLabel?: string;
  reasonForVisit?: string;
  bookingFor?: string;
  isMinorPatient?: boolean;
  declineReason?: string;
  providerId?: string;
}

const DECLINE_REASONS = [
  'No longer accepting this insurance plan',
  'Not accepting new patients at this time',
  'Outside scope of practice',
  'Appointment slot no longer available',
  'Please contact office to reschedule',
  'Other — please call our office',
];

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   '⏳ Pending',
  confirmed: '✓ Confirmed',
  cancelled: '✕ Cancelled',
  completed: '🎉 Completed',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, providerProfile, logout } = useAuth();

  const [bookings, setBookings]           = useState<Booking[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [declineId, setDeclineId]         = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!providerProfile?.providerId) return;
    const q = query(
      collection(db, 'bookings'),
      where('providerId', '==', providerProfile.providerId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Booking[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }));
      list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (a.date + a.time).localeCompare(b.date + b.time);
      });
      setBookings(list);
      setLoading(false);
    });
    return unsub;
  }, [providerProfile?.providerId]);

  const today = new Date().toISOString().split('T')[0];

  const filtered = bookings.filter(b => {
    if (filter === 'upcoming') return (b.status === 'pending' || b.status === 'confirmed') && b.date >= today;
    if (filter === 'past')     return b.status === 'completed' || b.status === 'cancelled' || b.date < today;
    return true;
  });

  const handleConfirm = async (booking: Booking) => {
    if (booking.providerId !== providerProfile?.providerId) return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy: user?.uid,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    if (!declineId || !declineReason) return;
    const booking = bookings.find(b => b.id === declineId);
    if (booking?.providerId !== providerProfile?.providerId) return;
    setActionLoading(declineId);
    try {
      await updateDoc(doc(db, 'bookings', declineId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: user?.uid,
        declineReason,
      });
      setDeclineId(null);
      setDeclineReason('');
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = bookings.filter(b => b.status === 'pending' && b.date >= today).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Top nav ────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <div>
              <span className="font-display text-slate-900 text-lg">AccessCare</span>
              <span className="text-slate-400 text-sm ml-2">Provider Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {providerProfile && (
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-700">{providerProfile.name}</div>
                <div className="text-xs text-slate-400">{providerProfile.specialty}</div>
              </div>
            )}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-display text-3xl text-slate-900 mb-1">
            Good {getTimeOfDay()}, {providerProfile?.name?.split(' ')[0] || 'Doctor'} 👋
          </h1>
          <p className="text-slate-500">
            {pendingCount > 0
              ? `You have ${pendingCount} pending appointment${pendingCount !== 1 ? 's' : ''} awaiting confirmation.`
              : 'No pending appointments — you\'re all caught up.'}
          </p>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pending',   value: bookings.filter(b => b.status === 'pending'   && b.date >= today).length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Confirmed', value: bookings.filter(b => b.status === 'confirmed' && b.date >= today).length, color: 'text-teal-600',  bg: 'bg-teal-50'  },
            { label: 'Total',     value: bookings.length,                                                          color: 'text-slate-700', bg: 'bg-slate-100' },
            { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length,                    color: 'text-red-600',   bg: 'bg-red-50'   },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-4`}>
              <div className={`font-display text-3xl ${color} mb-1`}>{value}</div>
              <div className="text-xs text-slate-500 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          {(['upcoming', 'all', 'past'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filter === tab
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Bookings list ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="font-display text-xl text-slate-700 mb-2">No appointments found</h3>
            <p className="text-slate-400 text-sm">
              {filter === 'upcoming' ? 'New appointment requests will appear here.' : 'Try switching to a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(booking => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-xs text-slate-400 font-bold uppercase">{formatWeekday(booking.date)}</div>
                  <div className="font-display text-xl text-slate-900">{formatMonthDay(booking.date)}</div>
                  <div className="text-sm font-semibold text-teal-600">{booking.time}</div>
                </div>

                <div className="w-px h-12 bg-slate-100 hidden sm:block" />

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{booking.patientName}</span>
                    {booking.bookingFor === 'dependent' && booking.isMinorPatient && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Minor</span>
                    )}
                  </div>
                  {booking.visitTypeLabel && (
                    <div className="text-sm text-slate-500">🩺 {booking.visitTypeLabel}</div>
                  )}
                  {booking.serviceCategoryLabel && (
                    <div className="text-sm text-teal-600">› {booking.serviceCategoryLabel}</div>
                  )}
                  {booking.reasonForVisit && (
                    <div className="text-xs text-slate-400 italic mt-1">{booking.reasonForVisit}</div>
                  )}
                  {booking.status === 'cancelled' && booking.declineReason && (
                    <div className="text-xs text-red-400 mt-1">Reason: {booking.declineReason}</div>
                  )}
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLES[booking.status]}`}>
                    {STATUS_LABELS[booking.status]}
                  </span>
                  {booking.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirm(booking)}
                        disabled={actionLoading === booking.id}
                        className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        {actionLoading === booking.id ? '...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => { setDeclineId(booking.id); setDeclineReason(''); }}
                        disabled={actionLoading === booking.id}
                        className="border border-slate-200 hover:border-red-200 hover:text-red-600 text-slate-500 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Decline modal ────────────────────────────────────────────────── */}
      {declineId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-xl text-slate-900 mb-2">Decline appointment</h3>
            <p className="text-slate-500 text-sm mb-6">
              Select a reason. The patient will be notified immediately.
            </p>
            <div className="space-y-2 mb-6">
              {DECLINE_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setDeclineReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
                    declineReason === reason
                      ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {declineReason === reason ? '● ' : '○ '}{reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeclineId(null); setDeclineReason(''); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason || actionLoading === declineId}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {actionLoading === declineId ? 'Declining...' : 'Decline appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatWeekday(dateStr: string) {
  if (!dateStr?.includes('-')) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatMonthDay(dateStr: string) {
  if (!dateStr?.includes('-')) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
