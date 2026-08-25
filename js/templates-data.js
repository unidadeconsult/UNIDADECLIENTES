const DEFAULT_TEMPLATES = [
    {
        id: 'tpl_01',
        title: 'Boas-vindas - Novo Cliente',
        category: 'boas-vindas',
        content: `Ola, {nome}! Tudo bem?

Seja muito bem-vindo(a) a UNIDADE CONSULT! E um prazer te-lo(a) como nosso cliente.

Meu nome e [Seu Nome] e serei responsavel pelo acompanhamento do seu processo de registro de marca.

A partir de agora, qualquer duvida ou necessidade, pode contar comigo por aqui.

Em breve entrarei em contato com atualizacoes sobre o andamento do seu processo.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_02',
        title: 'Atualizacao - Protocolo realizado',
        category: 'atualizacao',
        content: `Ola, {nome}! Tudo bem?

Informamos que o seu pedido de registro de marca foi protocolado junto ao INPI com sucesso!

Numero do processo: {processo}

O prazo medio de analise pelo INPI e de 8 a 12 meses. Durante esse periodo, acompanharemos semanalmente o andamento e informaremos qualquer movimentacao.

Qualquer duvida, estamos a disposicao.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_03',
        title: 'Atualizacao - Publicacao na RPI',
        category: 'atualizacao',
        content: `Ola, {nome}! Tudo bem?

Temos uma atualizacao sobre o seu processo {processo}:

O seu pedido de registro de marca foi publicado na Revista da Propriedade Industrial (RPI) desta semana.

Isso significa que o processo esta avancando normalmente. O pedido ficara em periodo de oposicao por 60 dias, onde terceiros podem se manifestar.

Estamos monitorando tudo e, caso haja qualquer movimentacao, entraremos em contato imediatamente.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_04',
        title: 'Prazo - Documento pendente',
        category: 'prazo',
        content: `Ola, {nome}! Tudo bem?

Estou entrando em contato para lembrar que temos um prazo pendente referente ao seu processo {processo}.

Precisamos do(s) seguinte(s) documento(s):
- [Descrever documentos necessarios]

O prazo para envio e ate [DATA].

Por favor, nos envie o mais breve possivel para que possamos dar continuidade ao processo.

Fico no aguardo.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_05',
        title: 'Cobranca - Lembrete de pagamento',
        category: 'cobranca',
        content: `Ola, {nome}! Tudo bem?

Espero que esteja bem! Estou entrando em contato para lembrar sobre a parcela referente ao servico de registro de marca junto ao INPI.

Detalhes:
- Valor: R$ [VALOR]
- Vencimento: [DATA]

Caso ja tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Qualquer duvida sobre valores ou formas de pagamento, estou a disposicao.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_06',
        title: 'Follow-up - Retomada de contato',
        category: 'follow-up',
        content: `Ola, {nome}! Tudo bem?

Faz um tempo que nao nos falamos e gostaria de saber como voce esta!

Aproveitando, gostaria de informar que continuamos acompanhando o seu processo {processo} e esta tudo em andamento.

Caso tenha alguma duvida ou precise de algo, estou a disposicao.

Abracos,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_07',
        title: 'Follow-up - Cliente sumiu',
        category: 'follow-up',
        content: `Ola, {nome}! Tudo bem?

Notei que faz um tempo que nao temos contato e quero me certificar de que esta tudo bem.

Tenho algumas atualizacoes sobre o andamento do seu processo que gostaria de compartilhar com voce.

Podemos conversar? Fico no aguardo do seu retorno.

Abracos,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_08',
        title: 'Certificado - Marca registrada',
        category: 'certificado',
        content: `Ola, {nome}! Tudo bem?

Tenho uma excelente noticia!

O seu registro de marca (processo {processo}) foi DEFERIDO pelo INPI! Isso significa que sua marca esta oficialmente protegida!

Proximo passo: emissao do certificado de registro.

Entraremos em contato em breve com mais detalhes sobre a finalizacao do processo.

Parabens! E um grande passo para a protecao do seu negocio.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_09',
        title: 'Oposicao - Notificacao recebida',
        category: 'oposicao',
        content: `Ola, {nome}! Tudo bem?

Informamos que foi apresentada uma oposicao ao seu pedido de registro de marca (processo {processo}).

Nao se preocupe, isso faz parte do processo e e relativamente comum. Nossa equipe ja esta analisando a oposicao para preparar a manifestacao de defesa.

Precisaremos conversar sobre alguns detalhes. Podemos agendar um horario?

Fico no aguardo.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_10',
        title: 'Prorrogacao - Renovacao de marca',
        category: 'prorrogacao',
        content: `Ola, {nome}! Tudo bem?

Estou entrando em contato para informar que o registro da sua marca (processo {processo}) esta proximo do vencimento e precisa ser renovado.

O prazo para a prorrogacao comeca [DATA] e e muito importante que seja feita dentro do prazo para manter a protecao da sua marca.

Podemos conversar sobre os detalhes e valores da renovacao?

Fico no aguardo.

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_11',
        title: 'Prospeccao - Primeiro contato',
        category: 'boas-vindas',
        content: `Ola, {nome}! Tudo bem?

Meu nome e [Seu Nome], sou da UNIDADE CONSULT, especializada em registro de marcas e patentes.

Estou entrando em contato pois notei que sua empresa {empresa} pode se beneficiar da protecao da sua marca junto ao INPI.

Voce sabia que sem o registro, qualquer pessoa pode usar o mesmo nome da sua empresa em todo o territorio nacional?

Gostaria de conversar sobre como podemos proteger o seu negocio. Posso te explicar rapidamente como funciona?

Atenciosamente,
UNIDADE CONSULT - Marcas e Patentes`
    },
    {
        id: 'tpl_12',
        title: 'Geral - Agradecimento',
        category: 'geral',
        content: `Ola, {nome}! Tudo bem?

Muito obrigado(a) pela confianca em nosso trabalho!

A UNIDADE CONSULT tem o compromisso de proteger o que e mais valioso para o seu negocio: sua marca.

Conte sempre conosco!

Abracos,
UNIDADE CONSULT - Marcas e Patentes`
    }
];
