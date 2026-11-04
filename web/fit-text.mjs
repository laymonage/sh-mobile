const SMALLEST_TEXT_PX = 10;

// Shrinks an element's text just enough to fit on one line, starting from the size its
// stylesheet gives it, so that short words can be large and long ones still fit. Words
// differ a lot here: the soft keys hold both "OK" and German's "Überspringen".
export function fitText(element) {
  element.style.fontSize = '';
  let size = Number.parseFloat(getComputedStyle(element).fontSize);
  while (element.scrollWidth > element.clientWidth && size > SMALLEST_TEXT_PX) {
    size = Math.max(SMALLEST_TEXT_PX, Math.floor((size * element.clientWidth) / element.scrollWidth) - 0.5);
    element.style.fontSize = `${size}px`;
  }
}
