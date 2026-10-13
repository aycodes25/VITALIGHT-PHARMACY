import { contact } from '../config.js'
import Icon from './Icon.jsx'

export default function PrescriptionBand() {
  return (
    <section className="container section">
      <div className="rx-band">
        <div>
          <p className="eyebrow">Prescription medicines</p>
          <h2>Have a prescription?</h2>
          <p>Contact our pharmacist and we will confirm availability and prepare your order. Prescription items are always verified before dispatch.</p>
        </div>
        <div className="rx-actions">
          {contact.phone && <a className="btn btn-primary" href={`tel:${contact.phone}`}>Call the pharmacy</a>}
          {contact.whatsapp && <a className="btn btn-outline-light" href={`https://wa.me/${contact.whatsapp}`}>WhatsApp us</a>}
          {!contact.phone && !contact.whatsapp && contact.email && <a className="btn btn-primary" href={`mailto:${contact.email}`}>Email the pharmacy <Icon name="arrow" size={16} /></a>}
        </div>
      </div>
    </section>
  )
}
