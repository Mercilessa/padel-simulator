import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const app = next({ dev: process.env.NODE_ENV !== 'production' })
const handle = app.getRequestHandler()

export const handler = async (event, context) => {
  try {
    await app.prepare()
    
    const { path, httpMethod, headers, body, queryStringParameters } = event
    
    const url = path + (queryStringParameters ? `?${new URLSearchParams(queryStringParameters)}` : '')
    const req = {
      method: httpMethod,
      url,
      headers,
      body
    }
    
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        body: '',
        multiValueHeaders: {},
        isBase64Encoded: false,
        
        status(code) {
          this.statusCode = code
          return this
        },
        
        setHeader(name, value) {
          this.headers[name] = Array.isArray(value) ? value.join(',') : value
          return this
        },
        
        end(body) {
          this.body = body
          resolve(this)
        }
      }
      
      handle(req, res, parse(url, true))
    })
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
