let output = document.querySelector('#output')

document.querySelector('#factorial').addEventListener('click', async () => {
  let result = await send('make-factorial', { num: 5 })
  output.innerHTML = result
})

document.querySelector('#call').addEventListener('click', async () => {
  let result = await send('ring-ring', { message: 'this is james' })
  output.innerHTML = result
})
