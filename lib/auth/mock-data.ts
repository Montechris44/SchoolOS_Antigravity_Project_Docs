import { School, User } from "@/types";

export const MOCK_PRIMARY_SCHOOL: School = {
  id: "sch_emerald_crest_001",
  name: "Emerald Crest Academy",
  slug: "emerald-crest",
  address: "14 Admiralty Way, Lekki Phase 1",
  city: "Lekki",
  state: "Lagos State",
  country: "Nigeria",
  phone: "+234 803 123 4567",
  email: "admin@emeraldcrest.sch.ng",
  currency: "NGN",
  createdAt: "2024-01-10T08:00:00Z",
};

export const MOCK_SECONDARY_SCHOOL: School = {
  id: "sch_gracefield_002",
  name: "Gracefield Grammar School",
  slug: "gracefield-grammar",
  address: "22 Oba Akinjobi Way, GRA",
  city: "Ikeja",
  state: "Lagos State",
  country: "Nigeria",
  phone: "+234 802 987 6543",
  email: "info@gracefield.sch.ng",
  currency: "NGN",
  createdAt: "2024-02-15T08:00:00Z",
};

export const MOCK_USERS: Record<string, { user: User; school: School }> = {
  owner: {
    user: {
      id: "usr_owner_01",
      email: "adebayo.proprietor@emeraldcrest.sch.ng",
      fullName: "Dr. Adeleke Adebayo",
      role: "owner",
      phone: "+234 803 555 1100",
      createdAt: "2024-01-10T08:00:00Z",
    },
    school: MOCK_PRIMARY_SCHOOL,
  },
  admin: {
    user: {
      id: "usr_admin_02",
      email: "f.balogun.principal@emeraldcrest.sch.ng",
      fullName: "Mrs. Funke Balogun",
      role: "admin",
      phone: "+234 803 555 2200",
      createdAt: "2024-01-12T08:00:00Z",
    },
    school: MOCK_PRIMARY_SCHOOL,
  },
  bursar: {
    user: {
      id: "usr_bursar_03",
      email: "c.okonkwo.accounts@emeraldcrest.sch.ng",
      fullName: "Mr. Chidi Okonkwo",
      role: "bursar",
      phone: "+234 803 555 3300",
      createdAt: "2024-01-15T08:00:00Z",
    },
    school: MOCK_PRIMARY_SCHOOL,
  },
  teacher: {
    user: {
      id: "usr_teacher_04",
      email: "i.musa.maths@emeraldcrest.sch.ng",
      fullName: "Mr. Ibrahim Musa",
      role: "teacher",
      phone: "+234 803 555 4400",
      createdAt: "2024-02-01T08:00:00Z",
    },
    school: MOCK_PRIMARY_SCHOOL,
  },
  parent: {
    user: {
      id: "usr_parent_05",
      email: "tunde.williams@gmail.com",
      fullName: "Engr. Tunde Williams",
      role: "parent",
      phone: "+234 803 555 5500",
      createdAt: "2024-02-10T08:00:00Z",
    },
    school: MOCK_PRIMARY_SCHOOL,
  },
  student: {
    user: {
      id: "usr_student_06",
      email: "femi.williams.std@emeraldcrest.sch.ng",
      fullName: "Femi Williams",
      role: "student",
      phone: "+234 803 555 6600",
      createdAt: "2024-02-10T08:00:00Z",
    },
    school: MOCK_PRIMARY_SCHOOL,
  },
};
