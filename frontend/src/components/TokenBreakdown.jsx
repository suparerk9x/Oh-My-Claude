import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatTokens, formatUSD } from '../utils/format';

/**
 * TokenBreakdown — inline "session · total · reuse ×N" with a click-to-open popover.
 *
 *   session  = input + output                              (เนื้องานจริง)
 *   total    = input + output + cacheRead + cacheCreate    (ทุกอย่างที่ส่งเข้า API จริง = บิล)
 *   reuse    = cacheRead / cacheCreate                     (cache เขียน 1 ครั้ง อ่านซ้ำ N ครั้ง — ยิ่งสูงยิ่งคุ้ม)
 *   savedUsd = cacheRead × (ราคา input − ราคา cacheRead)   (เงินที่ประหยัดจากการอ่าน cache)
 *
 * Note: hit-rate = cacheRead/(cacheRead+input) is NOT used — input_tokens counts only the
 * uncached delta, so it pins at ~100% for any cached session. reuse compares read↔write instead.
 *
 * Whole line is a button; clicking toggles a small popover. Click-outside / Esc closes it.
 */
export function TokenBreakdown({ session = 0, total = 0, cc1h = 0, reuse = null, savedUsd = null, scope = 'session', colors = {}, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!session && !total) return null;

  const cache = Math.max(0, total - session);

  const muted = colors?.text?.muted || 'text-gray-500';
  const secondary = colors?.text?.secondary || 'text-gray-300';
  const border = colors?.border || 'border-gray-700/60';
  const popBg = colors?.bg?.tertiary || 'bg-[#12121a]';
  const sessionColor = colors?.mini?.tokens || colors?.semantic?.amber?.text || 'text-amber-500';
  const totalColor = colors?.semantic?.sky?.text || 'text-sky-400';
  const successColor = colors?.status?.success || 'text-emerald-400';

  // reuse ×N — write once, read many. higher = cache paying off more.
  const reuseFmt = reuse == null ? null : reuse >= 10 ? `${Math.round(reuse)}` : reuse.toFixed(1);
  const reuseColor = reuse == null ? muted : reuse >= 10 ? successColor : reuse >= 3 ? 'text-amber-400' : muted;

  const scopeLabel = scope === 'fleet' ? 'รวมทุก session ที่เปิดอยู่' : 'เฉพาะ session นี้';

  const Row = ({ dot, label, val, desc }) => (
    <div className="flex items-start gap-1.5">
      <span className={`shrink-0 ${dot}`}>{label}</span>
      {val !== '' && <span className={`font-mono tabular-nums shrink-0 ${dot}`}>{val}</span>}
      <span className={`${muted} leading-snug`}>{desc}</span>
    </div>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center gap-0 rounded-md border ${border} overflow-hidden font-mono text-[9px] tabular-nums hover:opacity-90 transition-opacity`}
        title="คลิกดูรายละเอียด token"
      >
        <span className="flex items-center gap-1 px-1.5 py-0.5">
          <span className={`${sessionColor} opacity-70`} title="session — input + output (เนื้องานจริง)">⇄</span>
          <span className={sessionColor}>{formatTokens(session)}</span>
        </span>
        <span className={`flex items-center gap-1 px-1.5 py-0.5 border-l ${border}`}>
          <span className={`${totalColor} opacity-70`} title="total — รวม cache (เท่ากับบิล)">Σ</span>
          <span className={totalColor}>{formatTokens(total)}</span>
        </span>
        {reuseFmt != null && (
          <span className={`flex items-center gap-1 px-1.5 py-0.5 border-l ${border}`}>
            <span className={`${reuseColor} opacity-70`} title="reuse — cacheRead ÷ cacheCreate">↻</span>
            <span className={reuseColor}>×{reuseFmt}</span>
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-[60] bottom-full mb-1 ${align === 'right' ? 'right-0' : 'left-0'} w-[256px] p-2.5 rounded-lg border ${border} ${popBg} shadow-xl text-[9px] leading-relaxed`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`text-[9px] font-semibold uppercase tracking-wider mb-1.5 ${secondary}`}>
            Token breakdown <span className={`normal-case font-normal ${muted}`}>· {scopeLabel}</span>
          </div>
          <div className="space-y-1.5">
            <Row dot={sessionColor} label="session" val={formatTokens(session)} desc="input + output — เนื้องานจริง" />
            <Row dot={totalColor} label="total" val={formatTokens(total)} desc="รวม cache read/write — ที่ส่งเข้า API จริง (เท่ากับบิล)" />
            <Row dot={muted} label="cache" val={formatTokens(cache)} desc="ส่วนต่าง = context ที่อ่าน/เขียนซ้ำทุกเทิร์น" />
            {cc1h > 0 && (
              <div className="flex items-start gap-1.5 pl-3">
                <span className={`shrink-0 ${muted} opacity-80`}>↳ 1h-cache</span>
                <span className={`font-mono tabular-nums shrink-0 ${muted} opacity-80`}>{formatTokens(cc1h)}</span>
                <span className={`${muted} opacity-70 leading-snug`}>cache ชั้น 1 ชม. (เขียนแพง ~2×) — ส่วนหนึ่งของ cache</span>
              </div>
            )}
          </div>
          {(reuseFmt != null || (savedUsd != null && savedUsd > 0)) && (
            <div className={`mt-2 pt-2 border-t ${border} space-y-1.5`}>
              {reuseFmt != null && (
                <Row dot={reuseColor} label={`reuse ×${reuseFmt}`} val="" desc="cacheRead ÷ cacheCreate — เขียน cache 1 ครั้ง อ่านซ้ำ N ครั้ง · ยิ่งสูงยิ่งคุ้ม" />
              )}
              {savedUsd != null && savedUsd > 0 && (
                <Row dot={successColor} label="saved" val={`~${formatUSD(savedUsd)}`} desc="ประหยัดจาก cache read (ถูกกว่า input ~10×)" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

TokenBreakdown.propTypes = {
  session: PropTypes.number,
  total: PropTypes.number,
  cc1h: PropTypes.number,
  reuse: PropTypes.number,
  savedUsd: PropTypes.number,
  scope: PropTypes.oneOf(['session', 'fleet']),
  colors: PropTypes.object,
  align: PropTypes.oneOf(['left', 'right']),
};

export default TokenBreakdown;
