export default function IconButton({ label, className = "", children, ...props }) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
