const getPropertyObject = ( object ) => {
    switch (object) {
        case 'rent':
            return "Location"
            break;

        case 'sale':
            return "Vente"
            break;

        case 'daily_rent':
            return "Location journalière"
            break;
    
        default:
            break;
    }
}

const formatToMoney = (number) => {
    const parts = number.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join('.');
}
  

export { getPropertyObject, formatToMoney }