/**
 * Enunciados e critérios das discursivas de Informática Básica.
 * Critérios orientam a correção automática — escreva de forma clara para a IA.
 */
export const INFORMATICA_DISCURSIVE_QUESTIONS = [
  {
    legacyTexts: ['Cite dois exemplos de Hardware.'],
    question_text:
      'Cite dois exemplos de hardware. Hardware é a parte física do computador: equipamentos e componentes que você pode tocar.',
    expected_answer: [
      'O aluno deve citar DOIS exemplos corretos de hardware (parte física).',
      'Aceitar equivalentes e pequenos erros de escrita.',
      'Exemplos válidos: mouse, teclado, monitor, tela, impressora, scanner, webcam, microfone, fone de ouvido, caixa de som, HD, SSD, disco rígido, memória RAM, processador, CPU, placa-mãe, placa de vídeo, gabinete, notebook, computador, pendrive, cabo.',
      'NÃO aceitar como hardware: programas, aplicativos, sistema operacional, Windows, Word, Excel, Chrome, sites, plataformas web, jogos digitais, Gmail, WhatsApp, YouTube.',
      'Se misturar certos e errados, pontue só os corretos e explique a diferença no comentário.',
    ].join('\n'),
  },
  {
    legacyTexts: ['Cite dois exemplos de Software.'],
    question_text:
      'Cite dois exemplos de software. Software são os programas, aplicativos, sistemas operacionais e também sites ou plataformas digitais.',
    expected_answer: [
      'O aluno deve citar DOIS exemplos corretos de software (programas, sistemas ou serviços digitais).',
      'Aceitar equivalentes e pequenos erros de escrita.',
      'Exemplos válidos: Windows, Linux, macOS, Android, iOS, Word, Excel, PowerPoint, Chrome, Firefox, Edge, navegador, WhatsApp, Paint, Bloco de Notas, antivírus, sistema operacional, aplicativo, programa, Gmail, YouTube, Instagram, Facebook, GitHub, Railway, Vercel, site, sites, plataforma, jogo, jogos, game.',
      'NÃO aceitar como software: mouse, teclado, monitor, impressora, HD, SSD, memória RAM, processador, CPU, placa-mãe, cabo, peças físicas em geral.',
      'Sites e jogos digitais contam como software. Se misturar certos e errados, pontue só os corretos e explique a diferença no comentário.',
    ].join('\n'),
  },
] as const
