import client from './sanity'

const getCategories = async () => {
    try {
      const query = '*[_type == "category"]'
      const response = await client.fetch(query)

      return response
    } catch (error) {
      console.error('Error fetching data:', error)
    }
}

const getProperties = async () => {
    try {
      const query = '*[_type == "property"]'
      const response = await client.fetch(query)

      return response
    } catch (error) {
      console.error('Error fetching data:', error)
    }
}

export { getCategories, getProperties }