const express = require("express")
const app = express()  // this variable calls function to start express server
const server = require('http').Server(app) // allows us to create a server to be used with socket IO
// const io = require('socket.io')(server) // passes server created in line above into return value of require statement... lets io know what server to use
// const {v4 : uuidV4 } = require("uuid") // save reference to "v4" function from uuid library, but rename function to "uuidV4"
const path = require('path')
const bodyParser = require('body-parser')
const fs = require('fs')
const now = new Date()

const port = 12345 // port defaulted to when none is provided by the environment

app.use(express.static('./client/build'))
app.use(bodyParser.json())

// The root endpoint is the entry point to react game frontend
// app.get('/*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, 'client/build', 'index.html'))
// })

app.get('/get-letters', (req, res) => {
    const cur_date_formatted = now.getUTCDate()+"-"+now.getUTCMonth()+"-"+now.getUTCFullYear()

    fs.readFile('./db/date.txt', (err, data) => {
        if (err) throw err;

        const stored_date_formatted = data.toString()

        if(cur_date_formatted !== stored_date_formatted)
        {
            const { exec } = require('child_process');
            exec('cd db && java LettersGenerator', (err, stdout, stderr) => {
                if (err) throw err;
                send_letter_data( res );
            });

            fs.writeFile('./db/date.txt', cur_date_formatted, function (err) {
                if (err) throw err;
            });
        }
        else
        {
            send_letter_data( res );
        }
    })

    function send_letter_data( res ) {
        fs.readFile('db/letters.txt', (err, data) => {
            if (err) throw err;
    
            let letters_arr = (data.toString()).split('\n')
            letters_arr = letters_arr.slice(0, letters_arr.length - 1)
            
            fs.readFile('db/grid.txt', (err, data) => {
                if(err) throw err;
                let grid = new Array(8)
                let rows = (data.toString()).split('\n')
                rows = rows.slice(0, rows.length - 1)
                for(let i = 0; i < 8; i++) {
                    grid[i] = rows[i].split('')
                }
                const obj =  {
                    array: letters_arr,
                    grid: grid
                }
                const json_obj = JSON.stringify(obj)
                res.send(json_obj)
            })
        })
    }
})

app.post('/check-grid', (req, res) => {
    // Create set of all valid wordse
    fs.readFile('db/valid-words.txt', (err, data) => {
        if (err) throw err;

        let words_arr = (data.toString()).split('\n')
        words_arr = words_arr.slice(0, words_arr.length - 1)

        let valid_word_set = new Set();
        for(let i = 0; i < words_arr.length; i++)
        {
            valid_word_set.add(words_arr[i]);
        }

        const grid = req.body.grid;

        // Check left to right.
        for(let row = 0; row < 8; row++)
        {
            let word = '';
            for(let col = 0; col < 8; col++)
            {
                const letter = grid[row][col];
                if(letter !== '#')
                {
                    word += letter;
                }
                else
                {
                    if(word.length > 1 && !valid_word_set.has(word))
                    {
                        res.end(JSON.stringify({
                            "board_is_valid" : false,
                            "score" : 0
                        }));
                        return;
                    }
                    word = '';
                }
            }
        }

        // Check top to bottom. Also count letters
        let letter_count = 0;
        for(let col = 0; col < 8; col++)
        {
            let word = '';
            for(let row = 0; row < 8; row++)
            {
                const letter = grid[row][col];
                if(letter !== '#')
                {
                    word += letter;
                    letter_count++;
                }
                else
                {
                    if(word.length > 1 && !valid_word_set.has(word))
                    {
                        res.end(JSON.stringify({
                            "board_is_valid" : false,
                            "score": 0
                        }));
                        return;
                    }
                    word = '';
                }
            }
        }

        // Use DFS to check that all the letters are connected to each-other
        for(let row = 0; row < 8; row++)
        {
            for(let col = 0; col < 8; col++)
            {
                const letter = grid[row][col];
                if(letter !== '#')
                {
                    const contiguous_count = dfs(grid, row, col);
                    const board_valid = contiguous_count == letter_count
                    let score = 0;
                    if(board_valid)
                    {
                        score = contiguous_count;
                    }
                    res.end(JSON.stringify({
                        "board_is_valid" : board_valid,
                        "score" : score
                    }));
                    return;
                }
            }
        }
    })

    function dfs(grid, row, col)
    {
        if(row >= 8 || row < 0 || col >= 8 || col < 0 || grid[row][col] === '#')
        {
            return 0;
        }
        grid[row][col] = '#'
        const up = dfs(grid, row-1, col)
        const down = dfs(grid, row+1, col)
        const left = dfs(grid, row, col-1)
        const right = dfs(grid, row, col+1);

        return 1 + up + down + left + right
    }
})

// // This is called anytime somebody connects to our server.
// io.on('connection', socket => {
//     // Below are listeners that will be triggered by different user events.
//     socket.on('join-room', (room_id, user_id) => {
//         console.log("room joined")
//         socket.join(room_id) // tells socket to join a room with current user and provided room_id
//         io.emit('user-connected', user_id) // sends a message to everyone in this room with user_id of new user
//     })
// })

function start_server() {
    server.listen(process.env.PORT || port, () => console.log(`Server listening at http://localhost:${port}`))
}

start_server()