// web scrapping from CricInfo site on WC19.
// node project1.js --source="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" --excel="data.xlsx" --folder="WC19"

// npm init -y
// libraries used :-
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib

// download HTML using axios
// read the downloaded HTML file using jsdom
// make excel using excel4node
// make a WC19 folder(mkdir) and add pdf using pdf-lib

let minimist = require("minimist");
let fs = require("fs");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let path = require("path");

let args = minimist(process.argv);

let urlHTML = axios.get(args.source);
urlHTML.then(function(response){
    let html = response.data;

    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let totM = document.querySelectorAll( "div.match-score-block" );
    let matches =[];
    for( let i = 0 ; i < totM.length ; i++ ){
        let match = {
            t1: "",
            t2: "",
            t1S: "",
            t2S: "",
            result: ""
        };
        let teamName = totM[i].querySelectorAll( "div.name-detail > p.name" );
        match.t1 = teamName[0].textContent;
        match.t2 = teamName[1].textContent;

        let teamScore = totM[i].querySelectorAll( "div.score-detail > span.score" );
        if( teamScore.length == 2 ){
            match.t1S = teamScore[0].textContent;
            match.t2S = teamScore[1].textContent;
        }else if( teamScore.length == 1 ){
            match.t1S = teamScore[0].textContent;
            match.t2S = "";
        }else{
            match.t1S = "";
            match.t2S = "";
        }

        let resultM = totM[i].querySelector( "div.status-text > span" );
        match.result = resultM.textContent;
        
        matches.push(match);
    } 

    let matchesJSON = JSON.stringify( matches ); // 48 objects representing every match in worldcup19.
    fs.writeFileSync( "matches.json" , matchesJSON , "utf-8" );

    let teams = [];
    for( let i = 0 ; i < matches.length ; i++ ){
        arrangeForExcel( teams , matches[i] ); // we need a data that has india , nz , aus... matches seprate so that we can make excel.
    }
    for( let i = 0 ; i < matches.length ; i++ ){
        fillMatchesArray( teams , matches[i] ); // for every team created in arrangeForExcel() we need to fill its corresponding matches.
    }

    let teamsJSON = JSON.stringify( teams ); // 10 objects representing 10 teams of WC19 with there matches in matches array. 
    fs.writeFileSync( "teams.json" , teamsJSON , "utf-8" );

    createExcelFile( teams ); 

    createPDFFoloder( teams );

}).catch(function(err){
    console.log(err);
});

function arrangeForExcel( teams , match ){
    let t1idx = -1;
    for( let i = 0 ; i < teams.length ; i++ ){
        if( match.t1 == teams[i].name ){
            t1idx = i;
            break;
        }
    }
    if( t1idx == -1 ){
        teams.push({
            name: match.t1,
            matches: []
        });
    }

    let t2idx = -1;
    for( let i = 0 ; i < teams.length ; i++ ){
        if( match.t2 == teams[i].name ){
            t2idx = i;
            break;
        }
    }
    if( t2idx == -1 ){
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}

function fillMatchesArray( teams , match ){
    let t1idx = -1;
    for( let i = 0 ; i < teams.length ; i++ ){
        if( match.t1 == teams[i].name ){
            t1idx = i;
            break;
        }
    }
    let team1 = teams[t1idx];
    team1.matches.push({
        opponent: match.t2,
        Score: match.t1S,
        oppScore: match.t2S,
        result: match.result
    });

    let t2idx = -1;
    for( let i = 0 ; i < teams.length ; i++ ){
        if( match.t2 == teams[i].name ){
            t2idx = i;
            break;
        }
    }
    let team2 = teams[t2idx];
    team2.matches.push({
        opponent: match.t1,
        Score: match.t2S,
        oppScore: match.t1S,
        result: match.result
    });
}

function createExcelFile( teams ){

    let wb = new excel.Workbook();

    for( let i = 0 ; i < teams.length ; i++ ){
    
        let ws = wb.addWorksheet( teams[i].name );
    
        ws.cell(1,1).string( "Opponent" );
        ws.cell(1,2).string( "Score" );
        ws.cell(1,3).string( "Opponent Score" );
        ws.cell(1,4).string( "Result" );
    
        for( let j = 0 ; j < teams[i].matches.length ; j++ ){
            ws.cell(2+j,1).string(teams[i].matches[j].opponent);
            ws.cell(2+j,2).string(teams[i].matches[j].Score);
            ws.cell(2+j,3).string(teams[i].matches[j].oppScore);
            ws.cell(2+j,4).string(teams[i].matches[j].result);
        }
    }
    wb.write(args.excel);
}

function createPDFFoloder( teams ){

    // fs.mkdirSync( args.folder );

    for( let i = 0 ; i < teams.length ; i++ ){
        let nameF = path.join( args.folder , teams[i].name );
        // fs.mkdirSync( nameF ); // we need to make the folder before making directories in it.
        for( let j = 0 ; j < teams[i].matches.length ; j++ ){
            let nameFile = path.join( nameF , teams[i].matches[j].opponent + ".pdf" );
            createScoreCard( teams[i].name , teams[i].matches[j] , nameFile ); // function which creates scoreboard.
        }
    }
}

function createScoreCard( teamName , match , nameFile ){
    let t1 = teamName;
    let t2 = match.opponent;
    let t3 = match.Score;
    let t4 = match.oppScore;
    let t5 = match.result;

    let tempBytes = fs.readFileSync("template.pdf"); // reads the bits of template file.

    let loadBytes = pdf.PDFDocument.load(tempBytes); // loads them from secondary memory to main memory(RAM).these func give a promise
    loadBytes.then(function(pdfdoc){
        let page = pdfdoc.getPage(0); // all these changes are done in RAM. need to save them in ROM.
        page.drawText( t1 , {
            x: 160,
            y: 639,
            size: 16
        });
        page.drawText( t2 , {
            x: 160,
            y: 611,
            size: 16
        });
        page.drawText( t3 , {
            x: 435,
            y: 639,
            size: 16
        });
        page.drawText( t4 , {
            x: 435,
            y: 611,
            size: 16
        });
        page.drawText( t5 , {
            x: 140,
            y: 585,
            size: 16
        });
        let savePDF = pdfdoc.save(); // save them back to secondary memory.( promise )
        savePDF.then(function(newBytes){ 
            fs.writeFileSync( nameFile , newBytes );
        });
    });
}
