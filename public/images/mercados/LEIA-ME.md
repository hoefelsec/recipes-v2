# Logos dos mercados

Um arquivo por mercado, apontado pelo campo `logo` em `src/data/mercados.js`:

```js
zaffari: { nome: "Zaffari", logo: "public/images/mercados/zaffari.svg" }
```

O nome do arquivo é o **id** do mercado — assim não há como o campo apontar para o
logo do vizinho sem que fique óbvio na revisão.

Recomendações:

- **Formato:** `.svg`. Logo é desenho, não foto: escala sem borrar e pesa poucos
  bytes. `.png` funciona, mas prefira transparência e o dobro do tamanho de exibição.
- **Proporção:** deitada, por volta de 200 × 64. É a caixa em que ele vai aparecer
  numa lista de mercados.
- **`<title>` dentro do SVG:** o nome do mercado. É o que um leitor de tela anuncia
  quando o logo é a única coisa na linha.
- **Fundo:** transparente. O site tem fundo creme, e um retângulo branco em volta do
  logo aparece.

## Os três arquivos daqui são marcas de lugar

`zaffari.svg`, `nacional.svg` e `asun.svg` foram desenhados aqui — monograma e nome,
na paleta do site — e **não são as identidades visuais reais** dessas redes. Existem
para que o campo `logo` aponte para um arquivo que existe, em vez de para uma
promessa, e para que a tela que ainda vai usá-los tenha o que renderizar.

Trocar por um logo real é substituir o arquivo, sem mexer em nenhum código.
