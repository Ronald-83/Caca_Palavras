# PRD — Entrelinhas

**Status:** Rascunho para validação  
**Versão:** 0.1  
**Data:** 13 de outubro de 2026  
**Plataforma:** Navegador web  
**Nome:** Entrelinhas é um nome de trabalho, ainda não aprovado como marca.

## 1. Resumo

Entrelinhas é um jogo casual de dedução por letras, jogado no navegador. A pessoa tenta descobrir uma palavra secreta usando o feedback recebido após cada palpite. Cada partida permite até sete palpites. O produto deve oferecer desafio diário, prática livre, acesso a desafios anteriores, níveis de dificuldade e estatísticas, sem anúncios.

Este documento separa decisões confirmadas de propostas e questões em aberto. O protótipo visual existente é uma referência de interface, não uma especificação definitiva para as regras ainda não decididas.

## 2. Visão e objetivos

**Visão:** oferecer um desafio de palavras fácil de iniciar e jogar no navegador, com uma partida diária e opções para continuar praticando.

**Objetivos do produto:**

- Permitir que a pessoa comece a jogar sem instalação.
- Tornar as regras de dedução e o progresso de cada palpite fáceis de compreender.
- Oferecer mais de uma forma de jogar: desafio do dia, prática livre e arquivo.
- Dar visibilidade ao desempenho individual por meio de estatísticas.
- Manter a experiência sem anúncios.
- Ser utilizável em diferentes larguras de tela e por pessoas que usam teclado ou tecnologia assistiva.

**Não objetivos iniciais:** competição em tempo real, recursos sociais obrigatórios, notificações push, monetização por anúncios ou compras e aplicativo nativo. Esses itens não foram solicitados e não fazem parte do escopo atual.

## 3. Público e contexto

- **Público principal informado:** pessoas de 15 a 40 anos.
- **Contexto:** sessões curtas em navegador, em computador ou dispositivo móvel.
- **Plataforma confirmada:** navegador web.
- **Idioma e alcance geográfico:** ainda precisam ser definidos. O protótipo atual está em português brasileiro, mas isso não confirma por si só o idioma de lançamento.

A faixa de 15 a 40 anos define o público prioritário, não uma restrição de acesso a outras idades.

## 4. Proposta de valor

Um desafio diário de palavras com uma regra simples de dedução por letras, mais opções de prática e acompanhamento de desempenho, sem anúncios.

## 5. Escopo funcional

### 5.1 Modos de jogo

**Desafio diário — confirmado**

- Disponibilizar um novo desafio a cada dia.
- Permitir até sete palpites para descobrir a palavra.
- Encerrar a partida como vitória quando a pessoa acertar a palavra.
- Encerrar a partida sem vitória quando os sete palpites forem usados sem acerto.
- Após o fim da partida, exibir o resultado e a resposta, sem permitir novos palpites naquela rodada.

**Prática livre — confirmado**

- Permitir iniciar partidas adicionais fora do limite do desafio diário.
- Usar as mesmas regras centrais e o limite de sete palpites por partida.
- Não alterar sequência ou estatísticas do desafio diário, salvo decisão futura em contrário.

**Arquivo de desafios — confirmado como parte de “todos” os modos**

- Permitir acessar desafios diários anteriores.
- Indicar quais desafios já foram jogados e seus resultados, se o histórico estiver disponível.
- Não revelar uma resposta de desafio ainda não jogado antes do início da partida.
- A janela de histórico, as regras de acesso a partidas antigas e o tratamento de spoilers ainda precisam ser definidos.

### 5.2 Palpites e feedback

- O jogo deve aceitar um palpite por vez.
- Depois de um palpite válido, deve indicar para cada letra se ela está na posição correta, existe na palavra em outra posição ou não ocorre na palavra.
- O feedback deve respeitar corretamente letras repetidas na resposta e no palpite.
- Palpites inválidos não devem consumir uma das sete tentativas; a interface deve explicar como corrigir a entrada.
- A definição de “palpite válido” depende do idioma, do comprimento da palavra e da lista de palavras autorizadas, ainda a decidir.
- Se o idioma de lançamento for português, o tratamento de acentos deve ser consistente entre digitação, comparação e feedback. A política exata (por exemplo, se formas acentuadas e não acentuadas são equivalentes) está em aberto.

### 5.3 Palavras e conteúdo

A pessoa informou que o tipo de palavra pode variar. O produto deve permitir que o conteúdo varie, mas a variedade não pode comprometer a compreensão, a justiça ou a solvabilidade do desafio.

O jogo precisa manter uma lista curada ou uma fonte lexical validada para distinguir respostas possíveis de palpites aceitos. A lista de respostas deve ser revisada quanto a frequência, ambiguidade, regionalismos, flexões, nomes próprios e conteúdo ofensivo ou sensível. Os critérios editoriais finais dependem da definição de idioma e público.

### 5.4 Níveis de dificuldade

- Oferecer níveis de dificuldade selecionáveis.
- Comunicar o nível ativo antes do início da partida.
- Aplicar diferenças reais entre níveis, por meio de critérios consistentes de seleção de palavras e/ou de configuração do desafio.
- Não alterar silenciosamente a dificuldade de uma partida em andamento.

A quantidade e os nomes dos níveis, os critérios de dificuldade e se o nível pode variar o comprimento das palavras permanecem em aberto.

### 5.5 Estatísticas

A área de estatísticas deve apresentar, no mínimo, informação que ajude a pessoa a acompanhar seu próprio desempenho. Para a primeira versão, recomenda-se avaliar:

- partidas diárias concluídas;
- taxa de vitória;
- sequência atual e melhor sequência diária;
- número médio de palpites nas vitórias;
- distribuição de vitórias por número de palpites.

As métricas exatas, a inclusão de partidas livres e do arquivo nas estatísticas e o tratamento de uma derrota na sequência diária precisam de validação.

## 6. Requisitos de UX e acessibilidade

- As regras básicas devem ser compreensíveis sem tutorial longo.
- A partida deve manter sete linhas de tentativa disponíveis e evitar mudanças de layout durante o jogo.
- O estado das letras não pode depender somente da cor: deve haver também um símbolo, texto ou outra indicação perceptível.
- Os controles e o fluxo da partida devem ser operáveis por teclado, com foco visível e ordem de navegação previsível.
- O tabuleiro deve expor os estados e as mensagens de resultado a leitores de tela por meio de nomes e atualizações acessíveis.
- Mensagens de erro, vitória, derrota e palpites restantes devem ser anunciadas sem depender exclusivamente de animações ou cor.
- A interface deve se adaptar a telas móveis e desktop sem rolagem horizontal na área principal.
- Respeitar a preferência do sistema por movimento reduzido.

**Meta recomendada para validação:** WCAG 2.2 nível AA. Esta é uma meta proposta para o produto, ainda não uma certificação realizada.

## 7. Requisitos não funcionais

- O jogo deve ser acessível por navegador moderno, sem exigir instalação.
- A interação principal deve continuar responsiva em conexões comuns e evitar carregar recursos desnecessários.
- O produto não deve exibir anúncios.
- Dados pessoais devem ser minimizados. A necessidade de conta, sincronização entre dispositivos, telemetria e política de retenção não foi definida.
- A implementação deve manter respostas diárias consistentes para as pessoas que participam do mesmo desafio, caso seja decidido que o desafio é compartilhado globalmente.

## 8. Fluxos principais

### Jogar o desafio diário

1. A pessoa abre o jogo e vê o desafio disponível, o nível ativo e o número máximo de palpites.
2. Digita e envia um palpite.
3. O jogo valida a entrada, fornece feedback letra a letra e atualiza o número de palpites restantes.
4. O fluxo termina ao acertar ou após o sétimo palpite.
5. O resultado é registrado nas estatísticas conforme as regras de persistência definidas.

### Praticar

1. A pessoa seleciona prática livre e o nível desejado.
2. O jogo inicia uma nova palavra sem consumir ou alterar o desafio diário.
3. A pessoa joga com o mesmo limite de sete palpites.
4. Ao terminar, pode começar outra partida de prática.

### Consultar estatísticas e arquivo

1. A pessoa abre a área de estatísticas para consultar o próprio desempenho.
2. A pessoa pode abrir o arquivo e escolher um desafio anterior disponível.
3. O jogo informa o resultado e o estado da partida sem expor prematuramente respostas protegidas.

## 9. Critérios de aceite

- [ ] O jogo pode ser aberto e jogado em navegador sem instalação.
- [ ] Um desafio diário está disponível por dia, segundo um fuso horário a ser definido.
- [ ] Uma partida permite no máximo sete palpites válidos.
- [ ] Acertar a palavra encerra a partida com uma mensagem de vitória.
- [ ] Usar os sete palpites sem acertar encerra a partida e apresenta a resposta.
- [ ] Um palpite com formato inválido recebe uma explicação e não consome tentativa.
- [ ] O feedback distingue posição correta, letra presente em outra posição e letra ausente, inclusive para letras repetidas.
- [ ] O jogo oferece os níveis definidos para o lançamento e cada nível aplica uma regra de conteúdo verificável.
- [ ] É possível jogar o desafio diário, iniciar partidas de prática e acessar desafios anteriores.
- [ ] A tela de estatísticas apresenta as métricas aprovadas e usa dados persistidos conforme a política definida.
- [ ] Nenhum anúncio é exibido.
- [ ] Os estados das letras continuam compreensíveis sem percepção de cor.
- [ ] Os controles principais são utilizáveis por teclado e as mudanças de estado são anunciadas por tecnologia assistiva.
- [ ] A tela se adapta a dispositivos móveis sem rolagem horizontal na área do jogo.

## 10. Métricas de sucesso propostas

As métricas abaixo são propostas para avaliar o produto, não compromissos de meta numérica:

- taxa de conclusão do desafio diário;
- taxa de vitória e distribuição do número de palpites;
- proporção de partidas abandonadas;
- retorno ao desafio diário ao longo do tempo;
- uso de prática livre e do arquivo;
- frequência de entradas inválidas ou palavras não reconhecidas;
- problemas de acessibilidade encontrados em testes com teclado, leitor de tela e diferentes condições de percepção de cor.

As metas, a coleta e os prazos de retenção de dados devem ser definidos antes de instrumentar métricas de usuários.

## 11. Fora do escopo atual

- anúncios e compras no jogo;
- contas obrigatórias ou perfis públicos;
- multiplayer, duelos e placares competitivos;
- notificações push;
- aplicativo nativo;
- compartilhamento social obrigatório.

Compartilhamento sem spoiler pode ser avaliado depois, mas não foi confirmado como requisito.

## 12. Decisões em aberto

1. Qual será o idioma de lançamento? Apenas português brasileiro ou mais idiomas/variantes?
2. Qual será o comprimento das palavras e ele poderá variar entre níveis ou modos?
3. Como acentos, cedilha, letras repetidas, plurais, conjugação verbal, gírias, regionalismos e nomes próprios serão tratados?
4. Quais palavras serão aceitas como palpites e quais poderão aparecer como resposta? Quem revisará a lista?
5. Todos jogarão exatamente a mesma palavra diária? Qual fuso horário determina a troca do desafio?
6. Quantos níveis haverá, quais serão seus nomes e o que muda objetivamente entre eles?
7. O arquivo incluirá todos os desafios anteriores ou uma janela limitada? Haverá proteção contra spoilers?
8. Quais métricas de estatística entram na primeira versão? A prática livre conta nas estatísticas ou somente nos dados da própria prática?
9. As estatísticas ficam apenas no navegador ou sincronizam entre dispositivos? Conta é necessária ou opcional?
10. A sequência diária considera somente vitórias, qualquer partida concluída ou outra regra?
11. O resultado pode ser compartilhado sem revelar a resposta?
12. Existe uma meta formal de conformidade WCAG 2.2 AA e um processo de teste com pessoas usuárias?

## 13. Referência ao protótipo

O MVP atual em `index.html`, `styles.css`, `client.js` e `server.mjs` implementa a direção Caderno, desafio diário, prática livre, arquivo de 30 dias, níveis e estatísticas persistidas localmente. O léxico ainda é demonstrativo e suas decisões de idioma, tamanho de palavra, acentuação, níveis e sincronização continuam pendentes; os valores e palavras seed não representam conteúdo editorial aprovado.
