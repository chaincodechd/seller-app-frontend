export default [
    {
      id: "providerStoreName",
      title: "Provider Store Name",
      placeholder: "Enter provider store name",
      type: "input",
      required: true,
    },
    {
      id: "address",
      title: "Registered Address",
      placeholder: "Enter Provider Registered Address",
      type: "input",
      required: true,
    },
    {
      id: "contactEmail",
      title: "Email",
      placeholder: "Enter Provider Email Address",
      type: "input",
      email: true,
      required: true,
    },
    {
      id: "contactMobile",
      title: "Mobile Number",
      placeholder: "Enter Provider Mobile Number",
      type: "input",
      mobile: true,
      maxLength: 10,
      required: true,
    },
    {
      id: "PAN",
      title: "PAN",
      placeholder: "Enter Provider PAN",
      type: "input",
      maxLength: 10,
      required: true,
    },
    {
      id: "GSTN",
      title: "GSTIN",
      placeholder: "Enter your GSTIN",
      type: "input",
      maxLength: 15,
      required: true,
    },
    {
      id: "FSSAI",
      title: "FSSAI Number",
      placeholder: "Enter your FSSAI number",
      type: "input",
      maxLength: 14,
      required: true,
    },
];