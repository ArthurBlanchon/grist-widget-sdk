import type { GristWidgetDemo } from "grist-widget-sdk"

const MEMBERS: [string, string, string][] = [
  ["Alice Moreau", "alice.moreau@example.com", "2026-11-30"],
  ["Ben Carter", "ben.carter@example.com", "2026-12-15"],
  ["Carla Ruiz", "carla.ruiz@example.com", "2026-11-20"],
  ["David Kim", "david.kim@example.com", "2027-01-10"],
  ["Elsa Nyström", "elsa.nystrom@example.com", "2026-12-01"],
  ["Farid Haddad", "farid.haddad@example.com", "2026-11-25"],
  ["Greta Vogel", "greta.vogel@example.com", "2027-02-05"],
  ["Hugo Lefèvre", "hugo.lefevre@example.com", "2026-12-20"],
  ["Irene Costa", "irene.costa@example.com", "2026-11-18"],
  ["Jonas Berg", "jonas.berg@example.com", "2027-01-31"],
  ["Kemal Aydın", "kemal.aydin@example.com", "2026-12-08"],
  ["Lena Fischer", "lena.fischer@example.com", "2026-11-28"],
  ["Mateo Alves", "mateo.alves@example.com", "2027-03-01"],
  ["Nadia Popescu", "nadia.popescu@example.com", "2026-12-12"],
  ["Owen Price", "owen.price@example.com", "2026-11-22"],
]

/** A club's members, whose membership ends soon: a reminder per member, logged in Sent. */
export const demo: GristWidgetDemo = {
  tables: {
    Members: {
      columns: { Name: "Text", Email: "Text", MembershipEnds: "Date", Sent: "DateTime" },
      rows: MEMBERS.map(([Name, Email, MembershipEnds], i) => ({
        Name,
        Email,
        MembershipEnds,
        Sent: i < 3 ? `2026-11-1${i}T09:30:00Z` : null,
      })),
    },
  },
  mapping: { Email: "Email", Sent: "Sent" },
  options: {
    client: "mailto",
    subject: "Your membership ends on {{MembershipEnds}}",
    body: "Hello {{Name}},\n\nYour membership of the club ends on {{MembershipEnds}}. You can renew it at the front desk or by replying to this e-mail.\n\nSee you soon,\nThe club team",
  },
}
