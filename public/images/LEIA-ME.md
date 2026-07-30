# Imagens das receitas

Coloque aqui as fotos do resultado final e aponte para elas no arquivo da receita
em `src/data/`:

```js
imagem: {
  src: "public/images/brigadeiro.jpg",
  alt: "Descreva a foto em uma frase — isso é lido por leitores de tela.",
  credito: null            // ou { autor: "Seu Nome", url: "..." }
}
```

Recomendações:

- **Formato:** `.jpg` para fotos, `.webp` se quiser arquivos menores.
- **Tamanho:** 1600 px de largura é suficiente. Acima disso só pesa a página.
- **Proporção:** paisagem (16:9 ou 3:2). O topo da página recorta a imagem no
  centro, então deixe o prato centralizado.
- **Nome do arquivo:** minúsculas, sem acento e sem espaço — use o mesmo `slug`
  da receita (`bolo-de-cenoura.jpg`).

Enquanto não houver foto local, as receitas usam imagens do Unsplash. Se alguma
URL parar de funcionar, a página mostra um fundo degradê em vez de um ícone de
imagem quebrada.
