import { contact } from '../config.js'
import { whatsAppLink } from '../../../shared/whatsapp.js'
import Icon from './Icon.jsx'

export default function WhatsAppButton() {
  const href = whatsAppLink(contact.whatsapp, 'Hello Vitalight Pharmacy, I need some help.')
  if (!href) return null
  return (
    <a className="whatsapp-fab" href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat with Vitalight customer care on WhatsApp">
      <Icon name="whatsapp" size={26} />
    </a>
  )
}
