import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function CompassMark({ size = 34 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth=".8">
        <path d="m20 1 3.2 14.9L38 20l-14.8 3.5L20 39l-3.4-15.5L2 20l14.6-4.1Z" />
        <path d="m7 7 11.6 8.6 2.7.3L32.8 7l-8.5 12 0 2.2 8.4 11.9L21 24.4l-2.4-.2L7 33l8.7-12.1v-2Z" />
      </g>
      <path
        fill="currentColor"
        d="M20 2v18l-3.2-3.8Zm17 18H20l3.2-3.9ZM20 38V20l3.1 3.1ZM3 20h17l-3.3 3.3Z"
      />
      <circle cx="20" cy="20" r="1.9" fill="currentColor" />
    </svg>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    const trigger = document.activeElement;
    d.showModal();
    return () => {
      d.close();
      trigger?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={'modal ' + (wide ? 'modal-wide' : '')}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Schließen" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function UnitField({
  label,
  value,
  onChange,
  unit,
  type = 'number',
  ...rest
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="unit-field">
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {unit && <i>{unit}</i>}
      </span>
    </label>
  );
}
export function go(route) {
  location.hash = '/' + route;
}
