/** Mapeamento: tema fino do JSON → tema agrupado */

export const DIMENSION_GROUP_MAP: Record<string, string> = {
  'Fundamentos do computador': 'Fundamentos do computador',
  'Mouse e teclado': 'Fundamentos do computador',

  'Windows e área de trabalho': 'Windows e arquivos',
  'Arquivos e pastas': 'Windows e arquivos',
  'Atalhos e produtividade': 'Windows e arquivos',

  'Internet e navegadores': 'Internet e comunicação',
  'Pesquisa na Internet': 'Internet e comunicação',
  'E-mail': 'Internet e comunicação',

  'Segurança — golpes e phishing': 'Segurança digital',
  'Segurança — proteção': 'Segurança digital',
  'Defesa cibernética no dia a dia': 'Segurança digital',

  Word: 'Pacote Office',
  'Excel — fundamentos': 'Pacote Office',
  'Excel — aplicações práticas': 'Pacote Office',
  PowerPoint: 'Pacote Office',

  'Nuvem e armazenamento': 'Nuvem, IA e cidadania digital',
  'Vida digital': 'Nuvem, IA e cidadania digital',
  'Inteligência Artificial / ChatGPT': 'Nuvem, IA e cidadania digital',
  'Informação e cidadania digital': 'Nuvem, IA e cidadania digital',
}

export const GROUP_META: Record<
  string,
  { description: string; weight: number; target_percentage: number; display_order: number }
> = {
  'Fundamentos do computador': {
    description: 'Hardware, mouse, teclado e conceitos básicos',
    weight: 1,
    target_percentage: 15,
    display_order: 1,
  },
  'Windows e arquivos': {
    description: 'Sistema operacional, pastas, arquivos e atalhos',
    weight: 1,
    target_percentage: 15,
    display_order: 2,
  },
  'Internet e comunicação': {
    description: 'Navegadores, pesquisa e e-mail',
    weight: 1,
    target_percentage: 15,
    display_order: 3,
  },
  'Segurança digital': {
    description: 'Golpes, phishing, proteção e defesa no dia a dia',
    weight: 2,
    target_percentage: 15,
    display_order: 4,
  },
  'Pacote Office': {
    description: 'Word, Excel e PowerPoint',
    weight: 2,
    target_percentage: 25,
    display_order: 5,
  },
  'Nuvem, IA e cidadania digital': {
    description: 'Armazenamento em nuvem, vida digital, IA e cidadania',
    weight: 1,
    target_percentage: 15,
    display_order: 6,
  },
}

export function resolveDimensionGroup(name: string): string {
  return DIMENSION_GROUP_MAP[name] ?? name
}
