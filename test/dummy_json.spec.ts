import pactum from 'pactum';
import { SimpleReporter } from '../simple-reporter';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';

describe('DummyJSON API', () => {
  let token = '';
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://dummyjson.com';

  p.request.setDefaultTimeout(30000);

  beforeAll(() => p.reporter.add(rep));

  beforeEach(async () => {
    token = await p
      .spec()
      .post(`${baseUrl}/auth/login`)
      .withJson({
        username: 'emilys',
        password: 'emilyspass'
      })
      .expectStatus(StatusCodes.OK)
      .expectJsonLike({ username: 'emilys' })
      .returns('accessToken');
  });

  describe('Auth', () => {
    it('busca o usuário logado', async () => {
      await p
        .spec()
        .get(`${baseUrl}/auth/me`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: 1, username: 'emilys' });
    });

    it('login inválido', async () => {
      await p
        .spec()
        .post(`${baseUrl}/auth/login`)
        .withJson({
          username: 'emilys',
          password: faker.string.alphanumeric(8)
        })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectBodyContains('Invalid credentials');
    });

    it('usuário logado sem token', async () => {
      await p
        .spec()
        .get(`${baseUrl}/auth/me`)
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectBodyContains('Access Token is required');
    });
  });

  describe('Produtos', () => {
    it('busca um produto pelo id', async () => {
      await p
        .spec()
        .get(`${baseUrl}/products/1`)
        .expectStatus(StatusCodes.OK)
        .expectHeaderContains('content-type', 'application/json')
        .expectJsonSchema({
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            title: {
              type: 'string'
            },
            price: {
              type: 'number'
            },
            stock: {
              type: 'integer'
            },
            category: {
              type: 'string'
            }
          },
          required: ['id', 'title', 'price', 'stock', 'category']
        });
    });

    it('pesquisa produtos', async () => {
      await p
        .spec()
        .get(`${baseUrl}/products/search`)
        .withQueryParams({ q: 'phone', limit: 5 })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ limit: 5 })
        .expectBodyContains('products');
    });

    it('produto inexistente', async () => {
      await p
        .spec()
        .get(`${baseUrl}/products/0`)
        .expectStatus(StatusCodes.NOT_FOUND)
        .expectBodyContains("Product with id '0' not found");
    });

    it('cadastra um novo produto', async () => {
      const titulo = faker.commerce.productName();
      const preco = Number(faker.commerce.price());

      await p
        .spec()
        .post(`${baseUrl}/products/add`)
        .withBearerToken(token)
        .withJson({
          title: titulo,
          description: faker.commerce.productDescription(),
          price: preco,
          stock: 10,
          category: 'smartphones'
        })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike({ title: titulo, price: preco })
        .expectJsonSchema({
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            }
          },
          required: ['id']
        });
    });

    // DummyJSON não persiste escritas, então o PUT é feito num produto existente
    it('atualiza um produto', async () => {
      const titulo = faker.commerce.productName();

      await p
        .spec()
        .put(`${baseUrl}/products/1`)
        .withBearerToken(token)
        .withJson({
          title: titulo,
          price: 1500
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: 1, title: titulo, price: 1500 })
        .expectResponseTime(5000);
    });

    it('atualiza produto inexistente', async () => {
      await p
        .spec()
        .put(`${baseUrl}/products/99999`)
        .withBearerToken(token)
        .withJson({
          title: faker.commerce.productName()
        })
        .expectStatus(StatusCodes.NOT_FOUND)
        .expectBodyContains("Product with id '99999' not found");
    });

    it('exclui um produto', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/products/1`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: 1, isDeleted: true });
    });
  });

  describe('Carrinhos', () => {
    it('adiciona um novo carrinho', async () => {
      await p
        .spec()
        .post(`${baseUrl}/carts/add`)
        .withBearerToken(token)
        .withJson({
          userId: 1,
          products: [
            {
              id: 1,
              quantity: 2
            },
            {
              id: 2,
              quantity: 3
            }
          ]
        })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike({ userId: 1, totalProducts: 2, totalQuantity: 5 });
    });

    it('atualiza um carrinho', async () => {
      await p
        .spec()
        .put(`${baseUrl}/carts/1`)
        .withBearerToken(token)
        .withJson({
          merge: true,
          products: [
            {
              id: 1,
              quantity: 1
            }
          ]
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: 1 });
    });
  });

  afterAll(() => p.reporter.end());
});
