// Temporary mock extension data for testing. Remove this file and its usages
// once the real extension logic is implemented.

const MOCK_USER_EXTENSION = {
  preferredFirstName: "Alex",
  preferredLastName: "Sample",
  preferredName: "Alex Sample",
  workerId: "TEST-001",
  startDate: "2020-01-15",
  endDate: "",
  birthday: "06-15",
  hiringStatus: "active",
  state: null,
  country: "US",
  employments: [
    {
      contractId: "test-contract-001",
      title: "Software Engineer",
      startDate: "2020-01-15",
      contractType: "hris_direct_employee",
      state: null,
      country: "US",
      active: true,
      employeeNumber: null,
      team: {
        name: "Engineering",
      },
      customFields: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "Personal information - Gender",
          type: "list",
          data: { option: "Prefer not to say" },
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "Personal information - Marital Status",
          type: "list",
          data: { option: "Single" },
        },
        {
          id: "00000000-0000-0000-0000-000000000003",
          name: "Visa - Type",
          type: "text",
          data: { value: "Work Authorization" },
        },
        {
          id: "00000000-0000-0000-0000-000000000004",
          name: "Visa - Status",
          type: "text",
          data: { value: "Active" },
        },
        {
          id: "00000000-0000-0000-0000-000000000005",
          name: "Bank Information - Payroll Bank Name",
          type: "text",
          data: { value: "Test Bank" },
        },
        {
          id: "00000000-0000-0000-0000-000000000006",
          name: "Bank Information - Payroll Bank Location",
          type: "text",
          data: { value: "New York" },
        },
        {
          id: "00000000-0000-0000-0000-000000000007",
          name: "Bonus date",
          type: "date",
          data: { value: "2025-03-31" },
        },
        {
          id: "00000000-0000-0000-0000-000000000008",
          name: "Bonus amount",
          type: "currency",
          data: { amount: 5000, currency: "USD" },
        },
        {
          id: "00000000-0000-0000-0000-000000000009",
          name: "Bonus reason",
          type: "list",
          data: { option: "Annual Bonus" },
        },
        {
          id: "00000000-0000-0000-0000-000000000010",
          name: "Bonus comment",
          type: "text",
          data: { value: "Annual performance bonus" },
        },
        {
          id: "00000000-0000-0000-0000-000000000011",
          name: "Finance reporting - Employer Cost",
          type: "currency",
          data: { amount: 1000, currency: "USD" },
        },
        {
          id: "00000000-0000-0000-0000-000000000012",
          name: "Finance reporting - Paying Company",
          type: "list",
          data: { option: "Sample Corp Ltd." },
        },
        {
          id: "00000000-0000-0000-0000-000000000013",
          name: "Finance reporting - Paying Company Code",
          type: "list",
          data: { option: "00" },
        },
        {
          id: "00000000-0000-0000-0000-000000000014",
          name: "Finance reporting - Class",
          type: "list",
          data: { option: "R&D : Engineering" },
        },
        {
          id: "00000000-0000-0000-0000-000000000015",
          name: "Finance reporting - Group Department Code",
          type: "list",
          data: { option: "R&D" },
        },
        {
          id: "00000000-0000-0000-0000-000000000016",
          name: "Finance reporting - NetSuite Department Code",
          type: "list",
          data: { option: "R&D Engineering" },
        },
      ],
    },
  ],
  customFields: [
    {
      id: "00000000-0000-0000-0000-000000000017",
      name: "Brand allocations - Holiday.com",
      value: "0%",
    },
    {
      id: "00000000-0000-0000-0000-000000000018",
      name: "Brand allocations - Aircove",
      value: "0%",
    },
    {
      id: "00000000-0000-0000-0000-000000000019",
      name: "Brand allocations - XV",
      value: "50%",
    },
    {
      id: "00000000-0000-0000-0000-000000000020",
      name: "Brand allocations - CG",
      value: "50%",
    },
    {
      id: "00000000-0000-0000-0000-000000000021",
      name: "Brand allocations - PIA",
      value: "0%",
    },
    {
      id: "00000000-0000-0000-0000-000000000022",
      name: "Brand allocations - Intego",
      value: "0%",
    },
    {
      id: "00000000-0000-0000-0000-000000000023",
      name: "Brand allocations - WS",
      value: "0%",
    },
    {
      id: "00000000-0000-0000-0000-000000000024",
      name: "Brand allocations - Kape crossed brand",
      value: "0%",
    },
    {
      id: "00000000-0000-0000-0000-000000000025",
      name: "Performance Review - Date",
      value: "2024-12-31",
    },
    {
      id: "00000000-0000-0000-0000-000000000026",
      name: "Performance Review - Rating",
      value: "Meets Expectations",
    },
    {
      id: "00000000-0000-0000-0000-000000000027",
      name: "Performance Review - Comment",
      value: "Sample end of year performance review",
    },
    {
      id: "00000000-0000-0000-0000-000000000028",
      name: "Job information - Employment Status",
      value: "Full Time Employee",
    },
    {
      id: "00000000-0000-0000-0000-000000000029",
      name: "Job information - Employee Type",
      value: "Individual Contributor",
    },
    {
      id: "00000000-0000-0000-0000-000000000030",
      name: "Job Information - Bonus Eligibility",
      value: "1 to 2 Months",
    },
    {
      id: "00000000-0000-0000-0000-000000000031",
      name: "Reporting Team",
      value: "Engineering",
    },
    {
      id: "00000000-0000-0000-0000-000000000032",
      name: "Job information - Division",
      value: "Product & Technology",
    },
    {
      id: "00000000-0000-0000-0000-000000000033",
      name: "Career growth - Growth Path Code",
      value: "engineering-growth-path",
    },
  ],
  isManager: false,
  departmentHierarchy: "Engineering",
  departmentExternalId: null,
  departmentExternalIdHierarchy: null,
  workerTerminationLastDateOfWork: null,
  workLocation: "Remote",
};

const EXTENSION_SCHEMA = "urn:ietf:params:scim:schemas:extension:2.0:User";

export function withMockExtension(user: any): any {
  const schemas: string[] = user.schemas ?? [];
  return {
    ...user,
    schemas: schemas.includes(EXTENSION_SCHEMA)
      ? schemas
      : [...schemas, EXTENSION_SCHEMA],
    [EXTENSION_SCHEMA]: MOCK_USER_EXTENSION,
  };
}
