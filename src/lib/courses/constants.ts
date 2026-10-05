export const COURSE_COOKIE = 'anita_active_course'
export const STUDENT_COURSE_COOKIE = 'anita_student_course'

/** Curso que oferece o exercício de digitação. */
export const INFORMATICA_COURSE_SLUG = 'informatica-basica'

export const DEFAULT_COURSES = [
  {
    slug: INFORMATICA_COURSE_SLUG,
    name: 'Informática Básica',
    description:
      'Uso do computador no dia a dia: sistema operacional, editor de textos, planilhas, internet e comunicação digital.',
    hours: 40,
  },
  {
    slug: 'eletrica-basica',
    name: 'Elétrica Básica',
    description:
      'Fundamentos de eletricidade residencial: circuitos, segurança, medições e instalação básica.',
    hours: 40,
  },
] as const

export const ELETRICA_DIMENSIONS = [
  {
    name: 'Segurança elétrica',
    description: 'EPIs, riscos, choque elétrico e boas práticas de segurança.',
    target_percentage: 20,
    display_order: 1,
  },
  {
    name: 'Conceitos básicos',
    description: 'Tensão, corrente, resistência, potência e Lei de Ohm.',
    target_percentage: 20,
    display_order: 2,
  },
  {
    name: 'Circuitos e componentes',
    description: 'Circuitos série/paralelo, interruptores, tomadas e dispositivos.',
    target_percentage: 20,
    display_order: 3,
  },
  {
    name: 'Instalações residenciais',
    description: 'Quadros, disjuntores, fiação e leitura de diagramas simples.',
    target_percentage: 20,
    display_order: 4,
  },
  {
    name: 'Medições e diagnóstico',
    description: 'Uso de multímetro e identificação de falhas comuns.',
    target_percentage: 20,
    display_order: 5,
  },
] as const
