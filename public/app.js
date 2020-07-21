/* globals Framework7, axios, dateFormat*/

var app = new Framework7({
  theme: "md",
  routes: [
    {name: "loading",
     path: "/loading/",
     url: "./"
    },
    {
      name: "all",
      path: "/all/",
      url: "./all.html"
    },
    {
      name: "entry",
      path: "/entry/:id/",
      url: "./entry.html"
    }
  ]
});
var view = app.views.create('.view-main');

//main load
let load = function() {
   let id = new URLSearchParams(window.location.search).get("id")
   if (id) {
      view.router.navigate("/entry/" + id + "/")
   } else {
      view.router.navigate("/all/")
   }
}

//when an individual page loads
let loadPage = function(page) {
  switch(page.path.split("/")[1]) {
    case "all":
      // Get the data from the server
      axios.get("/all").then((response) => {
          window.entries = response.data
          let html = "";
          //loop through all entries
          for (let i in window.entries) {
            let entry = window.entries[i]
            // If clear was pressed when selecting the date on iOS, it will be invalid here
            let date;
            try {
                date = dateFormat(new Date(entry.date), "dddd, dS mmmm, yyyy")
            } catch (err) {
                date = "&nbsp"
            }
            html += `<li><a href="/entry/${entry.id}/" class="item-link item-content">` + 
              `<div class="item-inner"><div class="item-title-row"><div class="item-title">${entry.title} <span style="color:grey"> - ${entry.company}</span>\</div></div>` +
              `<div class="item-subtitle">${date}\</div></div</a></li>`
          }
          document.getElementById("entries").innerHTML = html
          
          //set date input in new popup
          let now = new Date()
          document.getElementById("date").value = dateFormat(now, "isoDate")
      })
      break;
      
    case "entry":
      //see which entry to load
      let entry = page.path.split("/")[2]
      //get entry from server
      axios.get("/entry?id=" + entry).then((response) => {
        //fill in fields
        document.getElementsByName("entryTitle")[0].innerHTML = response.data.title
        document.getElementsByName("entryTitle")[1].value = response.data.title
        document.getElementsByName("entryDate")[0].value = dateFormat(response.data.date, "isoDate")
        document.getElementsByName("entryNotes")[0].innerHTML = response.data.notes
        document.getElementsByName("entryPhone")[0].value = response.data.phone
        document.getElementsByName("entryCost")[0].value =  response.data.cost
        document.getElementsByName("entryPayment")[0].value = response.data.payment
        document.getElementsByName("entryCompany")[0].value = response.data.company
        if (response.data.notificationdate) {
          document.getElementsByName("entryNotDate")[0].value = dateFormat(response.data.notificationdate, "isoDate")
        }
        window.currentId = response.data.id
        
        //force textarea to resize
        app.input.resizeTextarea("#entryNotes")
      })
      
      break;
  }
}

//add a new entry
let addNew = function() {
  //get values
  let title = document.getElementsByName("title")[0].value;
  let date = document.getElementsByName("date")[0].value;
  let notes = document.getElementsByName("notes")[0].value;
  let notDate = document.getElementsByName("notDate")[0].value;
  let phone = document.getElementsByName("phone")[0].value;
  let cost = document.getElementsByName("cost")[0].value;
  let payment = document.getElementsByName("payment")[0].value;
  let company = document.getElementsByName("company")[0].value;
  
  //validate title
  if (title == "") {
    app.dialog.alert("Please enter a title", "Error")
    return
  }
  
  //send to server
  axios.post("/addNew", {title: title, date: date, notes: notes, notDate: notDate, phone: phone, cost: cost, payment: payment, company: company}).then((response) => {
    // Refresh the page
    loadPage({path: "/all/"})
    
    //clear input fields
    document.getElementsByName("title")[0].value = ""
    document.getElementsByName("notes")[0].value = ""
    document.getElementsByName("phone")[0].value = ""
    document.getElementsByName("cost")[0].value = ""
    document.getElementsByName("payment")[0].value = ""
    document.getElementsByName("company")[0].value = ""
    
    app.popup.close()
  })
}

//save edits
let save = function() {
  let title = document.getElementsByName("entryTitle")[1].value; // There are 2 divs with this name
  let date = document.getElementsByName("entryDate")[0].value;
  let notes = document.getElementsByName("entryNotes")[0].value;
  let notDate = document.getElementsByName("entryNotDate")[0].value;
  let phone = document.getElementsByName("entryPhone")[0].value;
  let cost = document.getElementsByName("entryCost")[0].value;
  let payment = document.getElementsByName("entryPayment")[0].value;
  let company = document.getElementsByName("entryCompany")[0].value;
  
  //validate title
  if (title == "") {
    app.dialog.alert("Please enter a title", "Error")
    return
  }
  
  //send to server
  console.log(title)
  axios.post("/save", {id: window.currentId, title: title, date: date, notes: notes, notDate: notDate, phone: phone, cost: cost, payment: payment, company: company}).then((response) => {
    // Go back
    view.router.back()
  })
}

//delete entry
let deleteEntry = function() {
  //check with the user
  app.dialog.confirm("Do you want to delete this entry?", "Are you sure?", () => {
    //tell server
    axios.post("/delete", {id: window.currentId}).then((response) => {
      // Go back
      view.router.back()
    })
  })
}

window.addEventListener('load', load) 
app.on("routeChanged", loadPage)