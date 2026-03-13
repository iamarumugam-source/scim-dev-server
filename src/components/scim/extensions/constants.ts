export const FAKER_GENERATORS: { label: string; value: string; category: string }[] = [
  { label: "Job Title",        value: "person.jobTitle",        category: "Person"   },
  { label: "Job Area",         value: "person.jobArea",         category: "Person"   },
  { label: "Job Type",         value: "person.jobType",         category: "Person"   },
  { label: "First Name",       value: "person.firstName",       category: "Person"   },
  { label: "Last Name",        value: "person.lastName",        category: "Person"   },
  { label: "Full Name",        value: "person.fullName",        category: "Person"   },
  { label: "Company Name",     value: "company.name",           category: "Company"  },
  { label: "Department",       value: "commerce.department",    category: "Company"  },
  { label: "Catch Phrase",     value: "company.catchPhrase",    category: "Company"  },
  { label: "City",             value: "location.city",          category: "Location" },
  { label: "Country",          value: "location.country",       category: "Location" },
  { label: "Country Code",     value: "location.countryCode",   category: "Location" },
  { label: "State",            value: "location.state",         category: "Location" },
  { label: "Phone Number",     value: "phone.number",           category: "Contact"  },
  { label: "Currency Code",    value: "finance.currencyCode",   category: "Finance"  },
  { label: "Amount",           value: "finance.amount",         category: "Finance"  },
  { label: "Date (Past)",      value: "date.past",              category: "Date"     },
  { label: "Date (Future)",    value: "date.future",            category: "Date"     },
  { label: "UUID",             value: "string.uuid",            category: "System"   },
  { label: "Numeric String",   value: "string.numeric",         category: "System"   },
  { label: "Word",             value: "lorem.word",             category: "Text"     },
];

export const USER_PROPS: { label: string; value: string; description: string }[] = [
  { label: "User ID",         value: "id",                 description: "Unique UUID for this user"              },
  { label: "Username",        value: "userName",           description: "Login identifier / email"               },
  { label: "Display Name",    value: "displayName",        description: "Preferred display name"                 },
  { label: "Full Name",       value: "name.formatted",     description: "Formatted full name"                    },
  { label: "Given Name",      value: "name.givenName",     description: "First / given name"                     },
  { label: "Family Name",     value: "name.familyName",    description: "Last / family name"                     },
  { label: "Title",           value: "title",              description: "Job title"                              },
  { label: "User Type",       value: "userType",           description: "Employee, Contractor…"                  },
  { label: "Locale",          value: "locale",             description: "Locale string (en-US, fr-FR…)"          },
  { label: "Timezone",        value: "timezone",           description: "IANA timezone (America/New_York…)"      },
  { label: "Language",        value: "preferredLanguage",  description: "Preferred language code"                },
  { label: "Primary Email",   value: "emails.0.value",     description: "First email in the emails array"        },
  { label: "Active",          value: "active",             description: "Boolean — is the account active?"       },
];

export const FIELD_TYPES = ["string", "integer", "boolean", "dateTime", "reference", "complex"] as const;

export const PRESET_URNS = [
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
  "urn:ietf:params:scim:schemas:extension:CustomAttributes:1.0:User",
];

export const TEMPLATE_EXAMPLES = [
  { token: "{{user.id}}",               label: "user ID"          },
  { token: "{{user.name.formatted}}",   label: "full name"        },
  { token: "{{user.emails.0.value}}",   label: "primary email"    },
  { token: "{{user.title}}",            label: "job title"        },
  { token: "{{faker.string.uuid}}",     label: "random UUID"      },
  { token: "{{faker.person.jobTitle}}", label: "random job title" },
];
