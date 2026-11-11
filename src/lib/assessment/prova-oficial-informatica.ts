/**
 * Banco oficial da Prova de Informática Básica (PDF Núcleo Anita Briza).
 * 8 de múltipla escolha (5 alternativas cada) + 2 discursivas já existentes no seed.
 */

export type OfficialMcOption = {
  key: 'A' | 'B' | 'C' | 'D' | 'E'
  text: string
  is_correct: boolean
  explanation: string
}

export type OfficialMcQuestion = {
  dimension: string
  question_text: string
  options: OfficialMcOption[]
}

/** Alternativa E inventada (documento original tinha só 4 opções). */
export const PROVA_OFICIAL_MC_QUESTIONS: OfficialMcQuestion[] = [
  {
    dimension: 'Fundamentos do computador',
    question_text: 'O que é Hardware?',
    options: [
      {
        key: 'A',
        text: 'Programas do computador.',
        is_correct: false,
        explanation: 'Programas são software, não hardware.',
      },
      {
        key: 'B',
        text: 'A parte física do computador.',
        is_correct: true,
        explanation: 'Hardware é tudo que você pode tocar: monitor, teclado, CPU, etc.',
      },
      {
        key: 'C',
        text: 'Um site.',
        is_correct: false,
        explanation: 'Site é conteúdo/software na internet.',
      },
      {
        key: 'D',
        text: 'A internet.',
        is_correct: false,
        explanation: 'Internet é a rede de comunicação, não a parte física do PC.',
      },
      {
        key: 'E',
        text: 'Um aplicativo de celular.',
        is_correct: false,
        explanation: 'Aplicativo é software.',
      },
    ],
  },
  {
    dimension: 'Fundamentos do computador',
    question_text: 'O que é Software?',
    options: [
      {
        key: 'A',
        text: 'A parte física do computador.',
        is_correct: false,
        explanation: 'Parte física é hardware.',
      },
      {
        key: 'B',
        text: 'Os programas utilizados no computador (parte lógica).',
        is_correct: true,
        explanation: 'Software são os programas, sistemas e aplicativos.',
      },
      {
        key: 'C',
        text: 'O teclado.',
        is_correct: false,
        explanation: 'Teclado é hardware.',
      },
      {
        key: 'D',
        text: 'Um cabo.',
        is_correct: false,
        explanation: 'Cabo é hardware.',
      },
      {
        key: 'E',
        text: 'A placa-mãe.',
        is_correct: false,
        explanation: 'Placa-mãe é um componente físico (hardware).',
      },
    ],
  },
  {
    dimension: 'Windows e arquivos',
    question_text: 'Para que servem as pastas no computador?',
    options: [
      {
        key: 'A',
        text: 'Navegar na internet.',
        is_correct: false,
        explanation: 'Navegação na internet é feita pelo navegador.',
      },
      {
        key: 'B',
        text: 'Organizar e armazenar arquivos.',
        is_correct: true,
        explanation: 'Pastas ajudam a organizar e guardar arquivos.',
      },
      {
        key: 'C',
        text: 'Instalar programas.',
        is_correct: false,
        explanation: 'Instalação de programas é outra função do sistema.',
      },
      {
        key: 'D',
        text: 'Desligar o computador.',
        is_correct: false,
        explanation: 'Desligar é feito pelo menu Iniciar / botão de energia.',
      },
      {
        key: 'E',
        text: 'Aumentar a velocidade da internet.',
        is_correct: false,
        explanation: 'Pastas não alteram a velocidade da conexão.',
      },
    ],
  },
  {
    dimension: 'Internet e comunicação',
    question_text: 'Qual é a principal função do e-mail?',
    options: [
      {
        key: 'A',
        text: 'Fazer ligações.',
        is_correct: false,
        explanation: 'Ligações são feitas por telefone ou apps de voz.',
      },
      {
        key: 'B',
        text: 'Enviar e receber mensagens e arquivos.',
        is_correct: true,
        explanation: 'E-mail serve para enviar e receber mensagens e anexos.',
      },
      {
        key: 'C',
        text: 'Editar fotos.',
        is_correct: false,
        explanation: 'Edição de fotos usa programas específicos.',
      },
      {
        key: 'D',
        text: 'Criar planilhas.',
        is_correct: false,
        explanation: 'Planilhas são feitas no Excel (ou similar).',
      },
      {
        key: 'E',
        text: 'Desligar o monitor.',
        is_correct: false,
        explanation: 'E-mail não controla o hardware do monitor.',
      },
    ],
  },
  {
    dimension: 'Pacote Office',
    question_text: 'Para que serve o Microsoft Word?',
    options: [
      {
        key: 'A',
        text: 'Criar apresentações.',
        is_correct: false,
        explanation: 'Apresentações são feitas no PowerPoint.',
      },
      {
        key: 'B',
        text: 'Criar e editar documentos de texto.',
        is_correct: true,
        explanation: 'Word é o editor de textos do Pacote Office.',
      },
      {
        key: 'C',
        text: 'Navegar na internet.',
        is_correct: false,
        explanation: 'Navegação usa Chrome, Edge, Firefox, etc.',
      },
      {
        key: 'D',
        text: 'Fazer cálculos.',
        is_correct: false,
        explanation: 'Cálculos e planilhas são função do Excel.',
      },
      {
        key: 'E',
        text: 'Gravar vídeos.',
        is_correct: false,
        explanation: 'Word não é ferramenta de gravação de vídeo.',
      },
    ],
  },
  {
    dimension: 'Fundamentos do computador',
    question_text: 'O que é um algoritmo?',
    options: [
      {
        key: 'A',
        text: 'Um programa.',
        is_correct: false,
        explanation: 'Programa pode implementar um algoritmo, mas não é a definição.',
      },
      {
        key: 'B',
        text: 'Uma sequência de passos para realizar uma tarefa.',
        is_correct: true,
        explanation: 'Algoritmo é a sequência lógica de passos para resolver algo.',
      },
      {
        key: 'C',
        text: 'Um vírus.',
        is_correct: false,
        explanation: 'Vírus é software malicioso, não a definição de algoritmo.',
      },
      {
        key: 'D',
        text: 'Um navegador.',
        is_correct: false,
        explanation: 'Navegador é um programa para acessar a internet.',
      },
      {
        key: 'E',
        text: 'Um tipo de impressora.',
        is_correct: false,
        explanation: 'Impressora é hardware.',
      },
    ],
  },
  {
    dimension: 'Segurança digital',
    question_text: 'Qual atitude ajuda a manter sua segurança na internet?',
    options: [
      {
        key: 'A',
        text: 'Compartilhar sua senha com amigos.',
        is_correct: false,
        explanation: 'Senha é pessoal e não deve ser compartilhada.',
      },
      {
        key: 'B',
        text: 'Clicar em qualquer link recebido.',
        is_correct: false,
        explanation: 'Links desconhecidos podem ser golpes (phishing).',
      },
      {
        key: 'C',
        text: 'Utilizar senhas fortes e não compartilhar informações pessoais.',
        is_correct: true,
        explanation: 'Senhas fortes e privacidade são práticas essenciais de segurança.',
      },
      {
        key: 'D',
        text: 'Desativar o antivírus.',
        is_correct: false,
        explanation: 'Antivírus ajuda a proteger o computador.',
      },
      {
        key: 'E',
        text: 'Usar a mesma senha em todos os sites.',
        is_correct: false,
        explanation: 'Reutilizar senha aumenta o risco se um site for invadido.',
      },
    ],
  },
  {
    dimension: 'Windows e arquivos',
    question_text: 'Qual atalho copia um texto?',
    options: [
      {
        key: 'A',
        text: 'Ctrl + V',
        is_correct: false,
        explanation: 'Ctrl + V cola.',
      },
      {
        key: 'B',
        text: 'Ctrl + X',
        is_correct: false,
        explanation: 'Ctrl + X recorta.',
      },
      {
        key: 'C',
        text: 'Ctrl + C',
        is_correct: true,
        explanation: 'Ctrl + C copia o conteúdo selecionado.',
      },
      {
        key: 'D',
        text: 'Ctrl + Z',
        is_correct: false,
        explanation: 'Ctrl + Z desfaz a última ação.',
      },
      {
        key: 'E',
        text: 'Ctrl + A',
        is_correct: false,
        explanation: 'Ctrl + A seleciona tudo; não copia.',
      },
    ],
  },
]
