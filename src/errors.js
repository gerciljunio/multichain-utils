export const errorResolverNotFound = (art = '', code = 404, data = null) => {
    return {
        code: code,
        data: data || `Resolver ${art.toUpperCase()} address not found`
    }
}