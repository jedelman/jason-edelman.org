// Handle suggestions under an input, as an ARIA combobox (after the library's).
// Typing asks Bluesky's AppView for matching accounts; arrow keys move, Enter or
// a tap picks, Escape closes. Picking fills the input and calls onPick(handle).
// Enter with nothing highlighted is left alone, so the form still submits.
import { searchActors } from './lib.js'

let seq = 0

export function attachTypeahead(input, onPick) {
  // The list hangs off a positioned wrapper around the input.
  let combo = input.parentElement
  if (!combo?.classList.contains('combo')) {
    combo = document.createElement('span')
    combo.className = 'combo'
    input.replaceWith(combo)
    combo.append(input)
  }
  const list = document.createElement('ul')
  list.className = 'typeahead'
  list.id = `typeahead-${++seq}`
  list.setAttribute('role', 'listbox')
  list.hidden = true
  combo.append(list)
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', list.id)
  input.autocomplete = 'off'

  let actors = []
  let active = -1
  let timer
  let ctrl
  const close = () => {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
    active = -1
  }
  const pick = (i) => {
    const a = actors[i]
    input.value = a.handle
    close()
    actors = []
    onPick(a.handle, a)
  }
  const render = () => {
    list.replaceChildren(
      ...actors.map((a, i) => {
        const li = document.createElement('li')
        li.id = `${list.id}-${i}`
        li.setAttribute('role', 'option')
        li.setAttribute('aria-selected', String(i === active))
        // mousedown, not click: it lands before the input's blur closes the list.
        li.addEventListener('mousedown', (e) => (e.preventDefault(), pick(i)))
        const pic = document.createElement(a.avatar ? 'img' : 'span')
        if (a.avatar) Object.assign(pic, { src: a.avatar, alt: '', loading: 'lazy' })
        else pic.className = 'avatar'
        pic.setAttribute('aria-hidden', 'true')
        const who = document.createElement('span')
        who.className = 'ta-who'
        if (a.displayName) who.append(Object.assign(document.createElement('strong'), { textContent: a.displayName }))
        who.append(Object.assign(document.createElement('span'), { className: 'ta-h', textContent: '@' + a.handle }))
        li.append(pic, who)
        return li
      }),
    )
    list.hidden = !actors.length
    // Keep the list on screen: it hangs from the input's right edge, which on a
    // phone can leave it running off the left side.
    list.style.right = ''
    if (!list.hidden) {
      const r = list.getBoundingClientRect()
      if (r.left < 8) list.style.right = `${r.left - 8}px`
      else if (r.right > innerWidth - 8) list.style.right = `${r.right - innerWidth + 8}px`
    }
    input.setAttribute('aria-expanded', String(!!actors.length))
    if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`)
    else input.removeAttribute('aria-activedescendant')
  }
  input.addEventListener('input', () => {
    clearTimeout(timer)
    ctrl?.abort()
    const q = input.value.trim().replace(/^@/, '')
    if (!q) return ((actors = []), close())
    timer = setTimeout(async () => {
      ctrl = new AbortController()
      try {
        actors = await searchActors(q, ctrl.signal)
        active = -1
        if (document.activeElement === input) render()
      } catch (e) {
        if (e.name !== 'AbortError') close()
      }
    }, 150)
  })
  input.addEventListener('keydown', (e) => {
    if (list.hidden || !actors.length) return
    if (e.key === 'ArrowDown') active = (active + 1) % actors.length
    else if (e.key === 'ArrowUp') active = (active - 1 + actors.length) % actors.length
    else if (e.key === 'Enter' && active >= 0) return e.preventDefault(), pick(active)
    else if (e.key === 'Escape') return e.stopPropagation(), close()
    else return
    e.preventDefault()
    render()
  })
  input.addEventListener('blur', () => setTimeout(close, 120))
}
