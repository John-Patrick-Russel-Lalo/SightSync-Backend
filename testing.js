
const sheesh = {
    "name": "sheesh",
    "age": 25,
    "hobby": "gaming"
}

const field = [];
const values = [];

for (const key in sheesh){
    console.log(`${key}: ${sheesh[key]}`);

    field.push(`${key} = $${field.length + 1}`);
    values.push(sheesh[key]);

    console.log(field);
    console.log(values);
}



console.log(field.join(", "));