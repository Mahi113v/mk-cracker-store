// Sample users for every demo company. Password column is shown in the guide.
// role: company_admin | staff | user      permissions: only used when role = staff
module.exports = [
  { name: 'Ravi Manager',   email: 'manager@{co}.com',   phone: '9000000001', password: 'password123',   role: 'staff', preset: 'manager' },
  { name: 'Suresh Stock',   email: 'stock@{co}.com',     phone: '9000000002', password: 'password123',   role: 'staff', preset: 'stock_keeper' },
  { name: 'Priya Sales',    email: 'sales@{co}.com',     phone: '9000000003', password: 'password123',   role: 'staff', preset: 'sales' },
  { name: 'Karthik Kumar',  email: 'customer1@{co}.com', phone: '9876500001', password: 'password123',   role: 'user' },
  { name: 'Divya',          email: 'customer2@{co}.com', phone: '9876500002', password: 'password123',   role: 'user' },
  { name: 'Arun Raj',       email: 'customer3@{co}.com', phone: '9876500003', password: 'password123',   role: 'user' },
];
