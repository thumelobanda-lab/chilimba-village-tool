export const DEFAULT_CONFIG = {
  groupName: "Hillcrest Chilimba",
  cycleName: "Cycle 3",
  recipientExempt: true,
  // A fixed amount from each member's settled contribution goes to each
  // fund below — editable any time from Group Setup (admin only). Applied
  // once per member per date, the moment their payments for that date
  // reach their due amount.
  funds: [
    { id: "future", name: "Future Sharing Fund", amount: 100, loanable: true },
    { id: "hospital", name: "Hospital Emergency Fund", amount: 20, loanable: false },
  ],
  schedule: [
    { id: "d1", date: "20 Jun 2026", group: "GROUP 1", payees: ["Doreen", "Dorothy"], due: 1200 },
    { id: "d2", date: "4 Jul 2026", group: "GROUP 2", payees: ["Harriet"], due: 1200 },
    { id: "d3", date: "18 Jul 2026", group: "GROUP 3", payees: ["Sarah C"], due: 1500 },
    { id: "d4", date: "1 Aug 2026", group: "GROUP 4", payees: ["Elizabeth"], due: 1700 },
    { id: "d5", date: "15 Aug 2026", group: "GROUP 5", payees: ["Doreen"], due: 1700 },
    { id: "d6", date: "29 Aug 2026", group: "GROUP 6", payees: ["Fridah"], due: 1700 },
    { id: "d7", date: "12 Sep 2026", group: "GROUP 7", payees: ["Vasty", "Josephine"], due: 1700 },
    { id: "d8", date: "26 Sep 2026", group: "GROUP 8", payees: ["Hildah", "Florence"], due: 1700 },
    { id: "d9", date: "10 Oct 2026", group: "GROUP 9", payees: ["Racheal", "Wonder"], due: 1700 },
    { id: "d10", date: "24 Oct 2026", group: "GROUP 10", payees: ["Malama", "Natasha"], due: 1700 },
    { id: "d11", date: "7 Nov 2026", group: "GROUP 11", payees: ["Likando", "Lydia2"], due: 1700 },
    { id: "d12", date: "21 Nov 2026", group: "GROUP 12", payees: ["Dorothy", "Michelo"], due: 1700 },
    { id: "d13", date: "5 Dec 2026", group: "GROUP 13", payees: ["Sarah N", "Zelipa"], due: 1700 },
    { id: "d14", date: "19 Dec 2026", group: "GROUP 14", payees: ["Jane", "Brenda"], due: 1700 },
    { id: "d15", date: "2 Jan 2027", group: "GROUP 15", payees: ["Lydia", "Sharon"], due: 1700 },
    { id: "d16", date: "16 Jan 2027", group: "GROUP 16", payees: ["Grace", "Tamiya"], due: 1700 },
    { id: "d17", date: "30 Jan 2027", group: "GROUP 17", payees: ["Mary", "Bongi"], due: 1700 },
    { id: "d18", date: "13 Feb 2027", group: "GROUP 18", payees: ["Edina", "Milimo"], due: 1700 },
    { id: "d19", date: "27 Feb 2027", group: "GROUP 19", payees: ["Sarah K"], due: 1700 },
    { id: "d20", date: "13 Mar 2027", group: "GROUP20", payees: ["Gift", "Bridget"], due: 1700 },
    { id: "d21", date: "27 Mar 2027", group: "GROUP 21", payees: ["Thabo", "Esther"], due: 1700 },
    { id: "d22", date: "10 Apr 2027", group: "GROUP 22", payees: ["Tambo"], due: 1700 },
    { id: "d23", date: "24 Apr 2027", group: "GROUP 23", payees: ["Jane", "Daka Mrs"], due: 1700 },
    { id: "d24", date: "8 May 2027", group: "GROUP 24", payees: ["Petronella", "Gwen"], due: 1700 },
  ],
};
