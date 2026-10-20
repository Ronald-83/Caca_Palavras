# Entrelinhas

MVP de jogo de dedução por letras, com interface Caderno, desafio diário, prática livre, arquivo e estatísticas.

## Requisitos

- Node.js 22.5 ou superior (`node:sqlite` integrado ao runtime).

Não há dependências npm externas. O banco SQLite é criado automaticamente em `data/entrelinhas.sqlite`.

## Executar

```sh
npm start
```

Abra `http://localhost:4174`. Para reiniciar automaticamente após alterações no código:

```sh
npm run dev
```

## Validar

```sh
npm run check
npm test
```

Os testes usam `node:test` e bancos temporários. As estatísticas e sessões do jogo ficam associadas a um cookie anônimo neste navegador; limpar os cookies remove essa associação. O arquivo SQLite local está excluído do controle de versão.

O servidor escuta apenas em `127.0.0.1` por padrão. Não defina `HOST` para uma interface pública sem configurar HTTPS, proxy confiável, política de retenção e controles operacionais.

O bootstrap usa Web Locks para serializar a criação do visitante entre abas em navegadores compatíveis. Sem Web Locks, duas abas abertas simultaneamente na primeira visita ainda podem criar identidades locais distintas.

## Limites do MVP

- As palavras são uma lista seed pequena e precisam de revisão editorial.
- O MVP usa palavras de cinco letras em português brasileiro e aceita palpites da lista curada local.
- O rollover diário usa `America/Sao_Paulo`.
- As estatísticas não sincronizam entre dispositivos.
- Cada nível tem seu próprio desafio diário no MVP; a sequência considera uma vitória em qualquer nível no dia.
- O MVP mantém visitantes e sessões no SQLite sem expiração automática. Definir retenção e exclusão antes de abrir o serviço ao público.
- SQLite atende à execução local em uma instância; o projeto técnico descreve a evolução possível para PostgreSQL.