/**
 * Create with AI — configurable UI copy (spec §0 rule 5 + §4 + Appendix A).
 *
 * All user-facing text marked "Copy" in the spec lives HERE, not hard-coded in
 * components. Later milestones extend this file (interview, draft, review, results).
 */

export const createWithAiCopy = {
  profile: {
    title: 'Business Profile',
    subtitle:
      'The only thing Create with AI remembers between campaigns. Fill this in once — every run starts here.',
    screens: {
      basics: {
        title: 'Business basics',
        hint: 'Who you are and what you do.',
      },
      sending: {
        title: 'Sending details',
        hint: 'How emails go out, and what readers see in the footer.',
      },
      extras: {
        title: 'Optional extras',
        hint: 'Leave anything empty and press "Skip for now". Nothing here blocks anything.',
      },
    },
    fields: {
      businessName: { label: 'Business name', placeholder: 'e.g. Sparkling Homes Exterior Cleaning' },
      businessType: { label: 'Business type', placeholder: 'e.g. Exterior cleaning company' },
      services: { label: 'Services or products', placeholder: 'Pressure washing\nGutter cleaning\nWindow cleaning', hint: 'One per line.' },
      serviceArea: { label: 'Service area', placeholder: 'e.g. San Jose and Santa Clara, or Online' },
      senderName: { label: 'Sender name', placeholder: 'e.g. Jack Stone' },
      replyToEmail: { label: 'Reply-to email', placeholder: 'e.g. hello@yourbusiness.com' },
      physicalAddress: { label: 'Business address', placeholder: 'Street, city, state, ZIP', hint: 'Required in the footer of every marketing email.' },
      bookingLink: { label: 'Booking or main action link', placeholder: 'https://yourbusiness.com/book' },
      phone: { label: 'Phone', placeholder: 'e.g. (408) 555-0132' },
      bookingOrPhoneHint: 'At least one of the booking link or phone is required.',
      customerType: { label: 'Customer type', placeholder: 'e.g. homeowners, property managers, members' },
      voiceDescription: { label: 'Voice and tone', placeholder: 'Describe how you talk to your customers.' },
      wordsToAvoid: { label: 'Words or phrases to never use', placeholder: 'One per line.' },
      websiteUrl: { label: 'Website link', placeholder: 'https://yourbusiness.com' },
      differentiators: { label: 'What sets you apart', placeholder: 'Facts only — what makes you different.' },
      guaranteesProof: { label: 'Guarantees, credentials, reviews', placeholder: 'e.g. 5-year warranty, licensed #12345, 4.9 stars from 212 reviews' },
    },
    prefill: {
      prompt: 'Have a website? Paste it and we will fill this in',
      button: 'Fill from website',
      fetching: 'Fetching your website…',
      fromWebsite: 'From your website',
      confirmHint: 'Review each suggestion below — nothing is saved until you confirm.',
      failed: 'Could not fetch that website. Continue manually — nothing else depends on it.',
      noneFound: 'Nothing usable was found on that site. Continue manually.',
    },
    samples: {
      link: 'Add examples of your writing',
      title: 'My Best Emails',
      hint: 'Optional. These only refine the voice — the AI writes a good email without them. Never required, never nagged about.',
      addPaste: 'Paste an email you wrote',
      addUpload: 'Upload .txt, .docx, or .pdf',
      approve: 'Approve',
      editSummary: 'Edit summary',
      generate: 'Generate style summary',
      generating: 'Writing the style summary…',
      approved: 'Approved — used for voice in drafts',
      pending: 'Needs your approval before it is used',
      limit: 'Limit: 10 samples, 10,000 characters each.',
      deleteConfirm: 'Delete this sample?',
    },
    buttons: {
      continue: 'Continue',
      back: 'Back',
      skip: 'Skip for now',
      save: 'Save profile',
      saving: 'Saving…',
      saved: 'Profile saved',
    },
    confirmCard: {
      title: 'Your Business Profile',
      continue: 'Looks right, continue',
      edit: 'Edit',
      lastUpdated: (date: string) => `Last updated ${date}. Anything changed?`,
      blocked: 'Fill in the missing required fields before continuing.',
      noProfile: 'No Business Profile yet. Set it up once — it takes under 2 minutes.',
      setup: 'Set up profile',
    },
    sidePanel: {
      title: 'Edit Business Profile',
      changedInProgress:
        'Your profile changed. Regenerate your draft with the update, or keep it as is?',
      regenerate: 'Regenerate draft',
      keep: 'Keep as is',
    },
  },
  flow: {
    title: 'Create with AI',
    interviewComing:
      'The interview starts in Milestone 2. For now, your profile is saved and the confirm card above is ready.',
  },
  errors: {
    aiNotConfigured:
      'AI is not configured on this server yet. Your work is saved — try again once AI is configured.',
    generic: 'Something went wrong. Your answers are saved.',
  },
};
