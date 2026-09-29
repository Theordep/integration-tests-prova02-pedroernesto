import pactum from 'pactum';
import { SimpleReporter } from '../simple-reporter';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';

describe('Restful-API.dev', () => {
  let idObjeto = '';
  const nomeObjeto = `${faker.commerce.productName()} ${faker.string.alphanumeric(6)}`;
  const nomeAtualizado = `${nomeObjeto} v2`;
  const preco = Number(faker.commerce.price({ min: 100, max: 3000 }));
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://api.restful-api.dev';

  p.request.setDefaultTimeout(30000);

  beforeAll(() => p.reporter.add(rep));

  describe('Consultas', () => {
    it('lista todos os objetos', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects`)
        .expectStatus(StatusCodes.OK)
        .expectHeaderContains('content-type', 'application/json')
        .expectJsonSchema({
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string'
              },
              name: {
                type: 'string'
              }
            },
            required: ['id', 'name']
          }
        });
    });

    it('busca objetos por lista de ids', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects`)
        .withQueryParams('id', 3)
        .withQueryParams('id', 5)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike([{ id: '3' }, { id: '5' }])
        .expectJsonLength(2);
    });

    it('busca um objeto pelo id', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects/7`)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: '7', name: 'Apple MacBook Pro 16' });
    });

    it('objeto inexistente', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects/${faker.string.alphanumeric(12)}`)
        .expectStatus(StatusCodes.NOT_FOUND)
        .expectBodyContains('was not found');
    });
  });

  // Esta API persiste os dados, então os testes abaixo dependem da ordem
  describe('Ciclo de vida de um objeto', () => {
    it('cadastra um novo objeto', async () => {
      idObjeto = await p
        .spec()
        .post(`${baseUrl}/objects`)
        .withJson({
          name: nomeObjeto,
          data: {
            year: 2024, 
            price: preco,
            color: faker.color.human()
          }
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ name: nomeObjeto, data: { price: preco } })
        .expectJsonSchema({
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            createdAt: {
              type: 'integer'
            }
          },
          required: ['id', 'createdAt']
        })
        .returns('id');
    });

    it('busca o objeto cadastrado', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects/${idObjeto}`)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: idObjeto, name: nomeObjeto });
    });

    it('atualiza o objeto', async () => {
      await p
        .spec()
        .put(`${baseUrl}/objects/${idObjeto}`)
        .withJson({
          name: nomeAtualizado,
          data: {
            year: 2025,
            price: preco + 100
          }
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          id: idObjeto,
          name: nomeAtualizado,
          data: { year: 2025, price: preco + 100 }
        })
        .expectJsonSchema({
          type: 'object',
          required: ['id', 'name', 'updatedAt']
        })
        .expectResponseTime(5000);
    });

    it('confirma a atualização', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects/${idObjeto}`)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ name: nomeAtualizado });
    });

    it('atualiza parcialmente o objeto', async () => {
      const novoNome = `${nomeObjeto} parcial`;

      await p
        .spec()
        .patch(`${baseUrl}/objects/${idObjeto}`)
        .withJson({ name: novoNome })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: idObjeto, name: novoNome });
    });

    it('exclui o objeto', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/objects/${idObjeto}`)
        .expectStatus(StatusCodes.OK)
        .expectBodyContains('has been deleted');
    });

    it('objeto excluído não é mais encontrado', async () => {
      await p
        .spec()
        .get(`${baseUrl}/objects/${idObjeto}`)
        .expectStatus(StatusCodes.NOT_FOUND);
    });
  });

  describe('Validações', () => {
    it('atualiza objeto inexistente', async () => {
      await p
        .spec()
        .put(`${baseUrl}/objects/${faker.string.alphanumeric(12)}`)
        .withJson({ name: faker.commerce.productName() })
        .expectStatus(StatusCodes.NOT_FOUND)
        .expectBodyContains("doesn't exist");
    });

    it('não permite excluir objeto reservado', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/objects/7`)
        .expectStatus(StatusCodes.METHOD_NOT_ALLOWED)
        .expectBodyContains('reserved id');
    });
  });

  afterAll(() => p.reporter.end());
});
