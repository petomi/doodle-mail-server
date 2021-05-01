/**
 * Set up logging method
 */
 const logWithDate = (message: string, isError?: boolean) : void => {
  console.log('logging')
  const currentTime = new Date()
  if (isError) {
    console.error(`${currentTime}: ${message}`)
  } else {
    console.log(`${currentTime}: ${message}`)
  }
}

export default logWithDate
