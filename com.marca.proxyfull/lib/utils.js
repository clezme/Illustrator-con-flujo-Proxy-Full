export function debounce(fn, wait = 300) {
  let timeout = null;
  return function debounced(...args) {
    const later = () => {
      timeout = null;
      fn.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
